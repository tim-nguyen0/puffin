from typing import Annotated

from fastapi import APIRouter, Depends

from ..adapters.gz import GzAdapter, entity_name
from ..adapters.ros_node import RosAdapter, world_name
from ..adapters.supervisor import SIM_PROGRAMS, SupervisorAdapter
from ..adapters.vehicle_env import AIRFRAMES, VehicleEnvAdapter
from ..deps import get_gz, get_ros, get_supervisor, get_vehicle_env
from ..models import Ack, ProcessInfo, SimStatus, VehiclePoseRequest, VehicleReplaceRequest

router = APIRouter(tags=["sim"])

Supervisor = Annotated[SupervisorAdapter, Depends(get_supervisor)]
Gz = Annotated[GzAdapter, Depends(get_gz)]
Ros = Annotated[RosAdapter, Depends(get_ros)]
Vehicles = Annotated[VehicleEnvAdapter, Depends(get_vehicle_env)]

PX4_PROGRAM = "px4"


@router.get("/sim/status")
def get_sim_status(supervisor: Supervisor, vehicles: Vehicles) -> SimStatus:
    vehicle = vehicles.current_model()
    result = supervisor.list_processes()
    if not result.ok:
        return SimStatus(running=False, world=world_name(), vehicle=vehicle, processes=[])
    processes = [ProcessInfo(**proc) for proc in result.data]
    by_name = {proc.name: proc.state for proc in processes}
    running = all(by_name.get(name) == "RUNNING" for name in SIM_PROGRAMS)
    return SimStatus(running=running, world=world_name(), vehicle=vehicle, processes=processes)


@router.post("/sim/start")
def start_sim(supervisor: Supervisor) -> Ack:
    result = supervisor.start_sim()
    return Ack(ok=result.ok, detail=result.detail)


@router.post("/sim/stop")
def stop_sim(supervisor: Supervisor) -> Ack:
    result = supervisor.stop_sim()
    return Ack(ok=result.ok, detail=result.detail)


@router.post("/sim/reset")
def reset_sim(gz: Gz) -> Ack:
    result = gz.reset_world()
    return Ack(ok=result.ok, detail=result.detail)


@router.post("/sim/vehicle", status_code=202)
def replace_vehicle(
    body: VehicleReplaceRequest, supervisor: Supervisor, gz: Gz, vehicles: Vehicles
) -> Ack:
    # one vehicle at a time: the new airframe takes the old one's place. px4
    # spawns its model on boot (PX4_GZ_STANDALONE), so the swap is env file ->
    # restart px4, with the old entity dropped while px4 is down.
    previous = vehicles.current_model()
    old_entity = entity_name(previous)

    selected = vehicles.select(body.model)
    if not selected.ok:
        return Ack(ok=False, detail=f"select {body.model}: {selected.detail}")

    stopped = supervisor.stop_program(PX4_PROGRAM)
    if not stopped.ok:
        return Ack(ok=False, detail=f"stop px4: {stopped.detail}")

    removed = gz.remove_entity(old_entity)
    if not removed.ok:
        # px4 stays down on purpose: restarting it now would spawn the new
        # model next to the old one, and single-vehicle is the whole contract
        return Ack(ok=False, detail=f"remove {old_entity}: {removed.detail}; px4 left stopped")

    started = supervisor.start_program(PX4_PROGRAM)
    if not started.ok:
        return Ack(ok=False, detail=f"start px4: {started.detail}")

    return Ack(
        ok=True,
        detail=(
            f"replaced {previous} with {body.model} "
            f"(SYS_AUTOSTART {AIRFRAMES[body.model]}); "
            f"{old_entity} removed, px4 restarting"
        ),
    )


@router.post("/sim/vehicle/pose")
def set_vehicle_pose(body: VehiclePoseRequest, gz: Gz, ros: Ros) -> Ack:
    # Teleporting an armed vehicle makes the EKF diverge; a flying drone moves
    # via offboard setpoints, never gz set_pose.
    telemetry = ros.latest_telemetry()
    if telemetry.ok and telemetry.data["armed"]:
        return Ack(ok=False, detail="refusing to move an armed vehicle; disarm first")
    result = gz.set_vehicle_pose(body.x, body.y, body.z, body.yaw_deg)
    return Ack(ok=result.ok, detail=result.detail)


@router.get("/procs")
def get_procs(supervisor: Supervisor) -> list[ProcessInfo]:
    result = supervisor.list_processes()
    if not result.ok:
        return []
    return [ProcessInfo(**proc) for proc in result.data]
