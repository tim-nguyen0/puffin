"""Wrapper around gz-transport. The only place that talks to Gazebo services.

The gz python bindings (python3-gz-transport13 / python3-gz-msgs10) only exist
inside the containers, so imports stay in method bodies; on any failure methods
degrade to a clean {ok, detail}. Sim manipulation goes through gz services ON
PURPOSE — never through ROS or PX4 (CLAUDE.md: three channels).
"""

import math
import os
import time
from typing import Any

from . import AdapterResult

REQUEST_TIMEOUT_MS = 2000
WORLD_READY_TIMEOUT_S = 20.0


def entity_name(model: str) -> str:
    # PX4's standalone gz bridge spawns the airframe as <model>_<instance>.
    return f"{model}_0"


def vehicle_model_name() -> str:
    from .vehicle_env import VehicleEnvAdapter

    # follows whatever /sim/vehicle last selected, so this stays right after a
    # replace instead of pointing at the airframe the image booted with
    return os.environ.get("PUFFIN_VEHICLE_MODEL", entity_name(VehicleEnvAdapter().current_model()))


class GzAdapter:
    def __init__(self, world: str | None = None) -> None:
        from .ros_node import world_name

        self._world = world or world_name()
        self._node: Any = None

    def _ensure_node(self) -> Any:
        if self._node is None:
            from gz.transport13 import Node

            self._node = Node()
        return self._node

    def _request(self, service: str, request: Any, request_type: Any, response_type: Any) -> Any:
        node = self._ensure_node()
        ok, response = node.request(
            service, request, request_type, response_type, REQUEST_TIMEOUT_MS
        )
        if not ok:
            raise TimeoutError(f"{service} did not respond within {REQUEST_TIMEOUT_MS}ms")
        return response

    def reset_world(self) -> AdapterResult:
        try:
            from gz.msgs10.boolean_pb2 import Boolean
            from gz.msgs10.world_control_pb2 import WorldControl

            request = WorldControl()
            request.reset.all = True
            response = self._request(
                f"/world/{self._world}/control", request, WorldControl, Boolean
            )
        except Exception as exc:  # noqa: BLE001 - clean {ok, detail} at the boundary
            return AdapterResult(ok=False, detail=f"world reset failed: {exc}")
        if not response.data:
            return AdapterResult(ok=False, detail="world reset rejected by gz")
        return AdapterResult(ok=True, detail=f"world {self._world} reset")

    def world_ready(self, timeout_s: float = WORLD_READY_TIMEOUT_S) -> AdapterResult:
        """Block until the world answers again. A restarted gz-server is gone
        from the bus for a second or two, and px4's bridge gets exactly one
        shot at spawning its model, so callers must wait before starting it."""
        deadline = time.monotonic() + timeout_s
        detail = "no reply"
        while time.monotonic() < deadline:
            try:
                from gz.msgs10.empty_pb2 import Empty
                from gz.msgs10.stringmsg_v_pb2 import StringMsg_V

                response = self._request("/gazebo/worlds", Empty(), Empty, StringMsg_V)
                if self._world in response.data:
                    return AdapterResult(ok=True, detail=f"world {self._world} is up")
                detail = f"gz serves {list(response.data)}, not {self._world}"
            except Exception as exc:  # noqa: BLE001 - clean {ok, detail} at the boundary
                detail = str(exc)
            time.sleep(0.25)
        return AdapterResult(
            ok=False, detail=f"world {self._world} not up in {timeout_s}s: {detail}"
        )

    def remove_entity(self, name: str) -> AdapterResult:
        try:
            from gz.msgs10.boolean_pb2 import Boolean
            from gz.msgs10.entity_pb2 import Entity

            request = Entity()
            request.name = name
            request.type = Entity.MODEL
            response = self._request(f"/world/{self._world}/remove", request, Entity, Boolean)
        except Exception as exc:  # noqa: BLE001 - clean {ok, detail} at the boundary
            return AdapterResult(ok=False, detail=f"remove {name} failed: {exc}")
        if not response.data:
            return AdapterResult(ok=False, detail=f"gz found no entity named {name}")
        return AdapterResult(ok=True, detail=f"{name} removed from world {self._world}")

    def set_vehicle_pose(
        self, x: float, y: float, z: float = 0.3, yaw_deg: float = 0.0
    ) -> AdapterResult:
        try:
            from gz.msgs10.boolean_pb2 import Boolean
            from gz.msgs10.pose_pb2 import Pose

            request = Pose()
            request.name = vehicle_model_name()
            request.position.x = float(x)
            request.position.y = float(y)
            request.position.z = float(z)
            half_yaw = math.radians(yaw_deg) / 2.0
            request.orientation.w = math.cos(half_yaw)
            request.orientation.z = math.sin(half_yaw)
            response = self._request(f"/world/{self._world}/set_pose", request, Pose, Boolean)
        except Exception as exc:  # noqa: BLE001 - clean {ok, detail} at the boundary
            return AdapterResult(ok=False, detail=f"set_pose failed: {exc}")
        if not response.data:
            return AdapterResult(ok=False, detail=f"set_pose rejected for {vehicle_model_name()}")
        return AdapterResult(ok=True, detail=f"{vehicle_model_name()} moved to ({x}, {y}, {z})")
