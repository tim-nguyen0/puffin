from typing import Annotated

from fastapi import APIRouter, Depends

from ..adapters.forge import ForgeAdapter
from ..adapters.ros_node import RosAdapter
from ..deps import get_forge, get_ros
from ..models import Ack, ForgeStatus, MissionRequest, MissionStatus

router = APIRouter(tags=["mission"])

Ros = Annotated[RosAdapter, Depends(get_ros)]
Forge = Annotated[ForgeAdapter, Depends(get_forge)]


@router.post("/mission", status_code=202)
def latch_mission(body: MissionRequest, ros: Ros) -> Ack:
    # latch, don't fly: mission_node reads the latest plan on activate, so
    # aborting is just deactivating the node via /ros/lifecycle
    result = ros.publish_mission(body.model_dump_json())
    return Ack(ok=result.ok, detail=result.detail)


@router.get("/mission")
def mission_status(ros: Ros) -> MissionStatus:
    result = ros.mission_status()
    if not result.ok:
        # degrade to idle with the failure in detail - the ui shows it verbatim
        return MissionStatus(state="idle", current_index=None, total=0, detail=result.detail)
    return MissionStatus(**result.data)


@router.post("/mission/forge", status_code=202)
def queue_forge(body: MissionRequest, forge: Forge) -> Ack:
    # same plan shape as /mission - the forge renders + colcon-builds it as a
    # standalone package instead of latching it onto the live mission_node
    result = forge.queue_spec(body.name, body.model_dump_json())
    return Ack(ok=result.ok, detail=result.detail)


@router.get("/mission/forge/{name}")
def forge_status(name: str, forge: Forge) -> ForgeStatus:
    result = forge.status(name)
    if not result.ok:
        # degrade to unknown with the failure in detail - same convention as mission_status
        return ForgeStatus(name=name, state="unknown", detail=result.detail)
    return ForgeStatus(**result.data)
