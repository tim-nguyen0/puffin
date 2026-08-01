import sqlite3
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException

from ..db import Database, create_token, hash_password, verify_password, verify_token
from ..deps import get_db
from ..models import LoginRequest, SignupRequest, TokenResponse, UserOut

router = APIRouter(tags=["auth"])

Db = Annotated[Database, Depends(get_db)]


def get_current_user(
    db: Db, authorization: Annotated[str | None, Header()] = None
) -> sqlite3.Row:
    if authorization is None or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="not authenticated")
    user_id = verify_token(authorization.removeprefix("Bearer "))
    if user_id is None:
        raise HTTPException(status_code=401, detail="invalid token")
    user = db.get_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="invalid token")
    return user


CurrentUser = Annotated[sqlite3.Row, Depends(get_current_user)]


@router.post("/auth/signup")
def signup(body: SignupRequest, db: Db) -> TokenResponse:
    if db.get_user_by_email(body.email) is not None:
        raise HTTPException(status_code=409, detail="email already registered")
    user_id = db.create_user(body.email, hash_password(body.password))
    return TokenResponse(token=create_token(user_id), user_id=user_id, email=body.email)


@router.post("/auth/login")
def login(body: LoginRequest, db: Db) -> TokenResponse:
    user = db.get_user_by_email(body.email)
    if user is None or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="invalid email or password")
    return TokenResponse(token=create_token(user["id"]), user_id=user["id"], email=user["email"])


@router.get("/auth/me")
def me(user: CurrentUser) -> UserOut:
    return UserOut(id=user["id"], email=user["email"])
