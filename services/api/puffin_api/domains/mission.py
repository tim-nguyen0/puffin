from typing import Annotated

from fastapi import APIRouter, Depends

from ..adapters.ros_node import RosAdapter
from ..deps import get_ros
from ..models import Ack, MissionRequest, MissionStatus

router = APIRouter(tags=["mission"])

Ros = Annotated[RosAdapter, Depends(get_ros)]


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
