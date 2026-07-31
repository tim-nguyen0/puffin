"""pure square-flight geometry. no ros imports so it tests anywhere."""

import math

SIDE_M = 10.0
ACCEPT_RADIUS_M = 0.7

# ned: z is down (gotcha #5). a drone activated on the ground would hold
# z ~ 0 and drag along the floor, so clamp the hold altitude to at least
# MIN_UP_M above the origin. min() because up is negative.
MIN_UP_M = 2.5


def hold_altitude(z0: float) -> float:
    return min(z0, -MIN_UP_M)


def square_waypoints(
    x0: float, y0: float, z_hold: float, side_m: float = SIDE_M
) -> list[tuple[float, float, float]]:
    # counter-clockwise from the start corner, ending back at it
    return [
        (x0 + side_m, y0, z_hold),
        (x0 + side_m, y0 + side_m, z_hold),
        (x0, y0 + side_m, z_hold),
        (x0, y0, z_hold),
    ]


def reached(
    current: tuple[float, float, float],
    target: tuple[float, float, float],
    radius_m: float = ACCEPT_RADIUS_M,
) -> bool:
    return math.dist(current, target) <= radius_m
