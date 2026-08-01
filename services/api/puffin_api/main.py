import os
import threading
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .adapters.compose import ComposeAdapter
from .adapters.gz import GzAdapter
from .adapters.ros_node import RosAdapter
from .adapters.supervisor import SupervisorAdapter
from .db import Database
from .domains import auth, ros, sim, system, telemetry, vehicle


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
    db: Database | None = None,
) -> FastAPI:
    app = FastAPI(title="Puffin API", version="0.1.0", lifespan=_lifespan)
    app.state.supervisor = supervisor or SupervisorAdapter()
    app.state.ros = ros_adapter or RosAdapter()
    app.state.compose = compose or ComposeAdapter()
    app.state.gz = gz or GzAdapter()
    app.state.db = db or Database(os.environ.get("PUFFIN_DB_PATH", "puffin.db"))
    for router in (auth.router, system.router, sim.router, vehicle.router, ros.router):
        app.include_router(router, prefix="/api")
    app.include_router(telemetry.router)
    return app


app = create_app()
