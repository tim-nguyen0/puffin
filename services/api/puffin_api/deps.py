import hashlib
import sqlite3
from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .adapters.compose import ComposeAdapter
from .adapters.forge import ForgeAdapter
from .adapters.gz import GzAdapter
from .adapters.ros_node import RosAdapter
from .adapters.supervisor import SupervisorAdapter
from .adapters.vehicle_env import VehicleEnvAdapter
from .db import connect_db
from .models import User

bearer = HTTPBearer(auto_error=False)


def get_supervisor(request: Request) -> SupervisorAdapter:
    return request.app.state.supervisor


def get_gz(request: Request) -> GzAdapter:
    return request.app.state.gz


def get_ros(request: Request) -> RosAdapter:
    return request.app.state.ros


def get_compose(request: Request) -> ComposeAdapter:
    return request.app.state.compose


def get_forge(request: Request) -> ForgeAdapter:
    return request.app.state.forge


def get_vehicle_env(request: Request) -> VehicleEnvAdapter:
    return request.app.state.vehicle_env


def get_db(request: Request) -> Iterator[sqlite3.Connection]:
    connection = connect_db(request.app.state.db_path)
    try:
        yield connection
    finally:
        connection.close()


Db = Annotated[sqlite3.Connection, Depends(get_db)]


def get_bearer_token(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> str:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return credentials.credentials


BearerToken = Annotated[str, Depends(get_bearer_token)]


def get_current_user(token: BearerToken, db: Db) -> User:
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    row = db.execute(
        """
        SELECT users.id, users.email
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token_hash = ?
        """,
        (token_hash,),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return User(id=row["id"], email=row["email"])


CurrentUser = Annotated[User, Depends(get_current_user)]
