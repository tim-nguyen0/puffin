"""Pydantic mirrors of packages/contract/openapi.yaml — the contract is the source of truth."""

from typing import Literal

from pydantic import BaseModel, Field

ProcessState = Literal[
    "STOPPED", "STARTING", "RUNNING", "BACKOFF", "STOPPING", "EXITED", "FATAL", "UNKNOWN"
]

LifecycleStateName = Literal["unconfigured", "inactive", "active", "finalized", "unknown"]

TransitionName = Literal["configure", "activate", "deactivate", "cleanup", "shutdown"]


class Health(BaseModel):
    status: Literal["ok"] = "ok"
    version: str


class Ack(BaseModel):
    ok: bool
    detail: str


class ProcessInfo(BaseModel):
    name: str
    state: ProcessState
    uptime_s: int


class SimStatus(BaseModel):
    running: bool
    world: str
    processes: list[ProcessInfo]


class TakeoffRequest(BaseModel):
    altitude_m: float = Field(ge=1, le=50)


class VehiclePoseRequest(BaseModel):
    x: float
    y: float
    z: float = Field(default=0.3, ge=0)
    yaw_deg: float = 0.0


class RosService(BaseModel):
    name: str
    type: str


class RosTopic(BaseModel):
    name: str
    type: str
    publishers: list[str]
    subscribers: list[str]


class RosGraph(BaseModel):
    nodes: list[str]
    topics: list[RosTopic]


class LifecycleState(BaseModel):
    node: str
    state: LifecycleStateName


class TransitionRequest(BaseModel):
    transition: TransitionName


class Waypoint(BaseModel):
    # ned meters: x north, y east, z down (5 m altitude = -5.0)
    x: float
    y: float
    z: float
    hold_s: float = Field(default=0.0, ge=0)


class MissionRequest(BaseModel):
    # ros node name for this mission's executor; priming an existing name
    # rebuilds that node with the new plan
    name: str = Field(default="mission", pattern=r"^[a-z][a-z0-9_]{0,30}$")
    waypoints: list[Waypoint] = Field(min_length=1, max_length=50)
    rate_hz: float = Field(default=20.0, ge=2, le=100)
    takeoff_z: float = -3.0
    return_to_origin: bool = True


ForgeStateName = Literal["unknown", "queued", "building", "done", "failed"]


class ForgeStatus(BaseModel):
    name: str
    state: ForgeStateName
    detail: str


MissionStateName = Literal[
    "idle", "ready", "flying", "holding", "returning", "done", "aborted"
]


class MissionStatus(BaseModel):
    # which mission executor reported this; absent until one exists
    node: str | None = None
    state: MissionStateName
    current_index: int | None = None
    total: int
    detail: str = ""


class SignupRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str
    password: str


class User(BaseModel):
    id: str
    email: str


class AuthResponse(BaseModel):
    token: str
    user: User


class UserSettings(BaseModel):
    units: Literal["metric", "imperial"]
    telemetry_history_limit: int = Field(ge=10, le=5000)
    ws_url: str = Field(min_length=1, max_length=500)
    api_base_url: str = Field(min_length=1, max_length=500)
    # floating terminal layout, css px offset from its default anchor
    terminal_x: float = Field(default=0.0, ge=-8192, le=8192)
    terminal_y: float = Field(default=0.0, ge=-8192, le=8192)
    terminal_minimized: bool = False


class UserSettingsUpdate(UserSettings):
    pass
