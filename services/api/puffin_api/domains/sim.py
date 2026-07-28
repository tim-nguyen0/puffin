from typing import Annotated

from fastapi import APIRouter, Depends

from ..adapters.ros_node import world_name
from ..adapters.supervisor import SIM_PROGRAMS, SupervisorAdapter
from ..deps import get_supervisor
from ..models import Ack, ProcessInfo, SimStatus

router = APIRouter(tags=["sim"])

Supervisor = Annotated[SupervisorAdapter, Depends(get_supervisor)]


@router.get("/sim/status")
def get_sim_status(supervisor: Supervisor) -> SimStatus:
    result = supervisor.list_processes()
    if not result.ok:
        return SimStatus(running=False, world=world_name(), processes=[])
    processes = [ProcessInfo(**proc) for proc in result.data]
    by_name = {proc.name: proc.state for proc in processes}
    running = all(by_name.get(name) == "RUNNING" for name in SIM_PROGRAMS)
    return SimStatus(running=running, world=world_name(), processes=processes)


@router.post("/sim/start")
def start_sim(supervisor: Supervisor) -> Ack:
    result = supervisor.start_sim()
    return Ack(ok=result.ok, detail=result.detail)


@router.post("/sim/stop")
def stop_sim(supervisor: Supervisor) -> Ack:
    result = supervisor.stop_sim()
    return Ack(ok=result.ok, detail=result.detail)


@router.get("/procs")
def get_procs(supervisor: Supervisor) -> list[ProcessInfo]:
    result = supervisor.list_processes()
    if not result.ok:
        return []
    return [ProcessInfo(**proc) for proc in result.data]
