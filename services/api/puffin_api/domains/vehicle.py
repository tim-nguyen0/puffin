from typing import Annotated

from fastapi import APIRouter, Depends

from ..adapters.ros_node import (
    VEHICLE_CMD_ARM_DISARM,
    VEHICLE_CMD_NAV_LAND,
    VEHICLE_CMD_NAV_TAKEOFF,
    RosAdapter,
)
from ..deps import get_ros
from ..models import Ack, TakeoffRequest

router = APIRouter(tags=["vehicle"])

Ros = Annotated[RosAdapter, Depends(get_ros)]


@router.post("/vehicle/arm")
def arm(ros: Ros) -> Ack:
    result = ros.send_vehicle_command(VEHICLE_CMD_ARM_DISARM, param1=1.0)
    return Ack(ok=result.ok, detail=result.detail)


@router.post("/vehicle/disarm")
def disarm(ros: Ros) -> Ack:
    result = ros.send_vehicle_command(VEHICLE_CMD_ARM_DISARM, param1=0.0)
    return Ack(ok=result.ok, detail=result.detail)


@router.post("/vehicle/takeoff")
def takeoff(body: TakeoffRequest, ros: Ros) -> Ack:
    result = ros.send_vehicle_command(VEHICLE_CMD_NAV_TAKEOFF, param7=body.altitude_m)
    return Ack(ok=result.ok, detail=result.detail)


@router.post("/vehicle/land")
def land(ros: Ros) -> Ack:
    result = ros.send_vehicle_command(VEHICLE_CMD_NAV_LAND)
    return Ack(ok=result.ok, detail=result.detail)
