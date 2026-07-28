from fastapi import FastAPI

from .adapters.compose import ComposeAdapter
from .adapters.ros_node import RosAdapter
from .adapters.supervisor import SupervisorAdapter
from .domains import ros, sim, system, telemetry, vehicle


def create_app(
    supervisor: SupervisorAdapter | None = None,
    ros_adapter: RosAdapter | None = None,
    compose: ComposeAdapter | None = None,
) -> FastAPI:
    app = FastAPI(title="Puffin API", version="0.1.0")
    app.state.supervisor = supervisor or SupervisorAdapter()
    app.state.ros = ros_adapter or RosAdapter()
    app.state.compose = compose or ComposeAdapter()
    for router in (system.router, sim.router, vehicle.router, ros.router):
        app.include_router(router, prefix="/api")
    app.include_router(telemetry.router)
    return app


app = create_app()
