"""px4 wire-level helpers shared by the lifecycle node and dummy_flight."""

from typing import Any

# VehicleCommand command ids (px4_msgs constants, stable across PX4 releases).
VEHICLE_CMD_NAV_LAND = 21
VEHICLE_CMD_DO_SET_MODE = 176
VEHICLE_CMD_ARM_DISARM = 400

# DO_SET_MODE param2/param3: px4 custom main mode / sub mode.
MAIN_MODE_AUTO = 4.0
MAIN_MODE_OFFBOARD = 6.0
SUB_MODE_AUTO_LOITER = 3.0

# offboard order (gotcha #4): stream setpoints at this rate for WARMUP_TICKS
# before requesting OFFBOARD, or px4 rejects the mode switch.
STREAM_HZ = 10.0
WARMUP_TICKS = 12


def fmu_qos() -> Any:
    """The ONE QoS profile for every /fmu/* pub and sub in this package.

    BEST_EFFORT + TRANSIENT_LOCAL + KEEP_LAST(1) — anything else matches px4
    silently never (gotcha #1). Mirrors puffin_api.adapters.ros_node, which
    this container-side package cannot import. Never inline another.
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


def now_us(node: Any) -> int:
    # px4_msgs timestamps are microseconds from the node clock (gotcha #7).
    return int(node.get_clock().now().nanoseconds // 1000)


def make_vehicle_command(
    node: Any,
    command: int,
    param1: float = 0.0,
    param2: float = 0.0,
    param3: float = 0.0,
) -> Any:
    from px4_msgs.msg import VehicleCommand

    msg = VehicleCommand()
    msg.timestamp = now_us(node)
    msg.command = command
    msg.param1 = float(param1)
    msg.param2 = float(param2)
    msg.param3 = float(param3)
    msg.target_system = 1
    msg.target_component = 1
    msg.source_system = 1
    msg.source_component = 1
    msg.from_external = True
    return msg


def make_offboard_control_mode(node: Any, velocity: bool = False) -> Any:
    from px4_msgs.msg import OffboardControlMode

    msg = OffboardControlMode()
    msg.timestamp = now_us(node)
    msg.position = not velocity
    msg.velocity = velocity
    return msg


def make_velocity_setpoint(
    node: Any, velocity: tuple[float, float, float], yaw_rate: float
) -> Any:
    from px4_msgs.msg import TrajectorySetpoint

    msg = TrajectorySetpoint()
    msg.timestamp = now_us(node)
    # nan position = velocity control only
    msg.position = [float("nan")] * 3
    msg.velocity = [float(velocity[0]), float(velocity[1]), float(velocity[2])]
    msg.acceleration = [float("nan")] * 3
    msg.yaw = float("nan")
    msg.yawspeed = float(yaw_rate)
    return msg


def make_position_setpoint(node: Any, target: tuple[float, float, float], yaw: float) -> Any:
    from px4_msgs.msg import TrajectorySetpoint

    msg = TrajectorySetpoint()
    msg.timestamp = now_us(node)
    msg.position = [float(target[0]), float(target[1]), float(target[2])]
    # nan = "position control only"; zeros would command zero velocity
    msg.velocity = [float("nan")] * 3
    msg.acceleration = [float("nan")] * 3
    msg.yaw = float(yaw)
    return msg
