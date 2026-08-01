"""pure teleop velocity logic. no ros imports so it tests anywhere."""

MAX_HORIZONTAL_M_S = 3.0
MAX_VERTICAL_M_S = 1.5
MAX_YAW_RATE_RAD_S = 1.0

# a stale command means the operator (or the websocket) went away - hover
DEADMAN_S = 0.5


def clamp(value: float, limit: float) -> float:
    return max(-limit, min(limit, value))


def safe_velocity(
    vx: float, vy: float, vz: float, yaw_rate: float, age_s: float
) -> tuple[float, float, float, float]:
    if age_s > DEADMAN_S:
        return (0.0, 0.0, 0.0, 0.0)
    return (
        clamp(vx, MAX_HORIZONTAL_M_S),
        clamp(vy, MAX_HORIZONTAL_M_S),
        clamp(vz, MAX_VERTICAL_M_S),
        clamp(yaw_rate, MAX_YAW_RATE_RAD_S),
    )
