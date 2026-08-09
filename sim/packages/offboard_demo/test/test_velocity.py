# run with `python3 -m pytest` from sim/offboard_demo - pure python, no ros.
from offboard_demo.velocity import (
    DEADMAN_S,
    MAX_HORIZONTAL_M_S,
    MAX_VERTICAL_M_S,
    safe_velocity,
)


def test_fresh_commands_pass_through() -> None:
    assert safe_velocity(1.0, -1.0, 0.5, 0.2, age_s=0.1) == (1.0, -1.0, 0.5, 0.2)


def test_commands_are_clamped() -> None:
    vx, vy, vz, _ = safe_velocity(99.0, -99.0, -99.0, 0.0, age_s=0.0)
    assert vx == MAX_HORIZONTAL_M_S
    assert vy == -MAX_HORIZONTAL_M_S
    assert vz == -MAX_VERTICAL_M_S


def test_stale_commands_become_hover() -> None:
    assert safe_velocity(2.0, 2.0, 1.0, 1.0, age_s=DEADMAN_S + 0.1) == (0.0, 0.0, 0.0, 0.0)
