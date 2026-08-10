import threading
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .adapters.compose import ComposeAdapter
from .adapters.forge import ForgeAdapter
from .adapters.gz import GzAdapter
from .adapters.ros_node import RosAdapter
from .adapters.supervisor import SupervisorAdapter
from .adapters.terminal import PtySession
from .adapters.vehicle_env import VehicleEnvAdapter
from .db import default_db_path, init_db
from .domains import (
    auth,
    mission,
    ros,
    settings,
    sim,
    system,
    telemetry,
    teleop,
    terminal,
    vehicle,
)


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    warmup = getattr(app.state.ros, "warmup", None)
    if warmup is not None:
        threading.Thread(target=warmup, name="ros-warmup", daemon=True).start()
    yield


def create_app(
    supervisor: SupervisorAdapter | None = None,
    ros_adapter: RosAdapter | None = None,
    compose: ComposeAdapter | None = None,
    gz: GzAdapter | None = None,
    forge: ForgeAdapter | None = None,
    vehicle_env: VehicleEnvAdapter | None = None,
    terminal_factory: type[PtySession] | None = None,
    db_path: str | None = None,
) -> FastAPI:
    app = FastAPI(title="Puffin API", version="0.1.0", lifespan=_lifespan)
    app.state.supervisor = supervisor or SupervisorAdapter()
    app.state.ros = ros_adapter or RosAdapter()
    app.state.compose = compose or ComposeAdapter()
    app.state.gz = gz or GzAdapter()
    app.state.forge = forge or ForgeAdapter()
    app.state.vehicle_env = vehicle_env or VehicleEnvAdapter()
    app.state.terminal_factory = terminal_factory or PtySession
    app.state.db_path = db_path or default_db_path()
    init_db(app.state.db_path)
    api_routers = (
        system.router,
        sim.router,
        vehicle.router,
        mission.router,
        ros.router,
        auth.router,
        settings.router,
    )
    for router in api_routers:
        app.include_router(router, prefix="/api")
    app.include_router(telemetry.router)
    app.include_router(teleop.router)
    app.include_router(terminal.router)
    return app


app = create_app()
