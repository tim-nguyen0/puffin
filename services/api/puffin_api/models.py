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


class NedPosition(BaseModel):
    x: float
    y: float
    z: float


class TelemetrySample(BaseModel):
    t_us: int
    armed: bool
    mode: str
    ned: NedPosition
    battery_v: float
