# run with `python3 -m pytest` from sim/offboard_demo — square.py is pure
# python, no ros needed.
from offboard_demo.square import (
    ACCEPT_RADIUS_M,
    hold_altitude,
    reached,
    square_waypoints,
)


def test_square_is_closed_and_ten_meters() -> None:
    waypoints = square_waypoints(1.0, 2.0, -5.0)
    assert len(waypoints) == 4
    assert waypoints[-1] == (1.0, 2.0, -5.0)
    assert waypoints[0] == (11.0, 2.0, -5.0)
    assert waypoints[1] == (11.0, 12.0, -5.0)
    assert waypoints[2] == (1.0, 12.0, -5.0)


def test_square_holds_one_altitude() -> None:
    assert {wp[2] for wp in square_waypoints(0.0, 0.0, -5.0)} == {-5.0}


def test_hold_altitude_keeps_a_flying_drone_where_it_is() -> None:
    assert hold_altitude(-5.0) == -5.0


def test_hold_altitude_lifts_a_grounded_drone() -> None:
    # ned: z near 0 is the ground; the clamp must go up (more negative)
    assert hold_altitude(-0.1) < -2.0
    assert hold_altitude(0.0) < -2.0


def test_reached_inside_and_outside_radius() -> None:
    target = (10.0, 0.0, -5.0)
    assert reached((10.0, 0.5, -5.0), target)
    assert not reached((10.0, ACCEPT_RADIUS_M + 0.1, -5.0), target)
