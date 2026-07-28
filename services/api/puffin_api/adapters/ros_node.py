"""Wrapper around rclpy. The only place that talks to ROS 2.

Framework stub: rclpy only exists inside the ROS-based containers, so every
method degrades to a clean {ok, detail} failure until implemented.
"""

import os
from typing import Any

from . import AdapterResult

# VehicleCommand command ids (px4_msgs constants, stable across PX4 releases).
VEHICLE_CMD_NAV_LAND = 21
VEHICLE_CMD_NAV_TAKEOFF = 22
VEHICLE_CMD_ARM_DISARM = 400

_NOT_IMPLEMENTED = AdapterResult(ok=False, detail="ros_node adapter not implemented yet")


def fmu_out_qos() -> Any:
    """The ONE QoS profile for every /fmu/out/* subscription.

    BEST_EFFORT + TRANSIENT_LOCAL + KEEP_LAST(1) — anything else matches PX4's
    publishers silently never, per CLAUDE.md gotcha #1. Never inline another.
    """
    from rclpy.qos import (
        DurabilityPolicy,
        HistoryPolicy,
        QoSProfile,
        ReliabilityPolicy,
    )

    return QoSProfile(
        reliability=ReliabilityPolicy.BEST_EFFORT,
        durability=DurabilityPolicy.TRANSIENT_LOCAL,
        history=HistoryPolicy.KEEP_LAST,
        depth=1,
    )


class RosAdapter:
    def list_services(self) -> AdapterResult:
        return _NOT_IMPLEMENTED

    def graph(self) -> AdapterResult:
        return _NOT_IMPLEMENTED

    def lifecycle_state(self, node_name: str) -> AdapterResult:
        return _NOT_IMPLEMENTED

    def lifecycle_transition(self, node_name: str, transition: str) -> AdapterResult:
        return _NOT_IMPLEMENTED

    def send_vehicle_command(
        self, command: int, param1: float = 0.0, param7: float = 0.0
    ) -> AdapterResult:
        return _NOT_IMPLEMENTED

    def latest_telemetry(self) -> AdapterResult:
        return _NOT_IMPLEMENTED


def world_name() -> str:
    return os.environ.get("PUFFIN_WORLD", "puffin")
