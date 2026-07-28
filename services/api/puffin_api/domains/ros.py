from typing import Annotated

from fastapi import APIRouter, Depends

from ..adapters.ros_node import RosAdapter
from ..deps import get_ros
from ..models import Ack, LifecycleState, RosGraph, RosService, TransitionRequest

router = APIRouter(tags=["ros"])

Ros = Annotated[RosAdapter, Depends(get_ros)]


@router.get("/ros/services")
def list_services(ros: Ros) -> list[RosService]:
    result = ros.list_services()
    if not result.ok:
        return []
    return [RosService(**svc) for svc in result.data]


@router.get("/ros/graph")
def get_graph(ros: Ros) -> RosGraph:
    result = ros.graph()
    if not result.ok:
        return RosGraph(nodes=[], topics=[])
    return RosGraph(**result.data)


@router.get("/ros/lifecycle/{node_name}")
def get_lifecycle_state(node_name: str, ros: Ros) -> LifecycleState:
    result = ros.lifecycle_state(node_name)
    state = result.data if result.ok else "unknown"
    return LifecycleState(node=node_name, state=state)


@router.post("/ros/lifecycle/{node_name}/transition")
def transition(node_name: str, body: TransitionRequest, ros: Ros) -> Ack:
    result = ros.lifecycle_transition(node_name, body.transition)
    return Ack(ok=result.ok, detail=result.detail)
