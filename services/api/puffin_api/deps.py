from fastapi import Request

from .adapters.compose import ComposeAdapter
from .adapters.gz import GzAdapter
from .adapters.ros_node import RosAdapter
from .adapters.supervisor import SupervisorAdapter
from .db import Database


def get_supervisor(request: Request) -> SupervisorAdapter:
    return request.app.state.supervisor


def get_db(request: Request) -> Database:
    return request.app.state.db


def get_gz(request: Request) -> GzAdapter:
    return request.app.state.gz


def get_ros(request: Request) -> RosAdapter:
    return request.app.state.ros


def get_compose(request: Request) -> ComposeAdapter:
    return request.app.state.compose
