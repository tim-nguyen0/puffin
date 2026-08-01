import hashlib
import hmac
import secrets
import sqlite3
import uuid

from fastapi import APIRouter, HTTPException, status

from ..deps import BearerToken, CurrentUser, Db
from ..models import AuthResponse, LoginRequest, SignupRequest, User

router = APIRouter()

PASSWORD_ITERATIONS = 200_000


def normalize_email(email: str) -> str:
    return email.strip().casefold()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt, PASSWORD_ITERATIONS
    )
    return f"{PASSWORD_ITERATIONS}${salt.hex()}${digest.hex()}"


def password_matches(password: str, saved_hash: str) -> bool:
    try:
        iterations_text, salt_text, digest_text = saved_hash.split("$")
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode(),
            bytes.fromhex(salt_text),
            int(iterations_text),
        )
        return hmac.compare_digest(digest.hex(), digest_text)
    except (ValueError, TypeError):
        return False


def create_session(db: sqlite3.Connection, user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    db.execute(
        "INSERT INTO sessions (token_hash, user_id) VALUES (?, ?)",
        (token_hash, user_id),
    )
    db.commit()
    return token


@router.post("/auth/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest, db: Db) -> AuthResponse:
    email = normalize_email(body.email)
    if "@" not in email:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid email"
        )

    user = User(id=str(uuid.uuid4()), email=email)
    try:
        db.execute(
            "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
            (user.id, user.email, hash_password(body.password)),
        )
        db.execute("INSERT INTO user_settings (user_id) VALUES (?)", (user.id,))
        db.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Account already exists"
        ) from None

    return AuthResponse(token=create_session(db, user.id), user=user)


@router.post("/auth/login", response_model=AuthResponse)
def login(body: LoginRequest, db: Db) -> AuthResponse:
    row = db.execute(
        "SELECT id, email, password_hash FROM users WHERE email = ?",
        (normalize_email(body.email),),
    ).fetchone()
    if row is None or not password_matches(body.password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    user = User(id=row["id"], email=row["email"])
    return AuthResponse(token=create_session(db, user.id), user=user)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(token: BearerToken, user: CurrentUser, db: Db) -> None:
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    db.execute("DELETE FROM sessions WHERE token_hash = ? AND user_id = ?", (token_hash, user.id))
    db.commit()


@router.get("/auth/me", response_model=User)
def me(user: CurrentUser) -> User:
    return user
