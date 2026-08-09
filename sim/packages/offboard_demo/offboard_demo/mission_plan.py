"""pure mission parsing and step planning. no ros imports so it tests anywhere.

a mission arrives as the json body the api latched onto /puffin/mission —
the MissionRequest shape from packages/contract/openapi.yaml. planning
turns it into a flat list of steps the node walks with reached().
"""

import json
import math
import re
from typing import Any

MAX_WAYPOINTS = 50
MIN_RATE_HZ = 2.0
MAX_RATE_HZ = 100.0
DEFAULT_RATE_HZ = 20.0
DEFAULT_TAKEOFF_Z = -3.0

# the executor's ros node name, so it is also a ros name: lowercase, no
# dashes, no leading digit. same pattern the contract enforces.
NAME_PATTERN = "^[a-z][a-z0-9_]{0,30}$"
NAME_RE = re.compile(NAME_PATTERN)
DEFAULT_NAME = "mission"

# ned: z is down. missions that would fly at/below the ground are refused
# rather than clamped - a surprise altitude is worse than a rejection.
MIN_UP_M = 1.0


class MissionError(ValueError):
    pass


def _finite(value: Any, field: str) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise MissionError(f"{field} is not a number") from exc
    if not math.isfinite(number):
        raise MissionError(f"{field} is not finite")
    return number


def parse_mission(raw: str) -> dict[str, Any]:
    try:
        body = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise MissionError(f"mission is not json: {exc}") from exc
    if not isinstance(body, dict):
        raise MissionError("mission must be an object")

    name = body.get("name", DEFAULT_NAME)
    # fullmatch, not match: "$" alone would let a trailing newline through
    if not isinstance(name, str) or not NAME_RE.fullmatch(name):
        raise MissionError(f"name must match {NAME_PATTERN}")

    waypoints = body.get("waypoints")
    if not isinstance(waypoints, list) or not waypoints:
        raise MissionError("waypoints must be a non-empty list")
    if len(waypoints) > MAX_WAYPOINTS:
        raise MissionError(f"too many waypoints (max {MAX_WAYPOINTS})")

    parsed = []
    for i, wp in enumerate(waypoints):
        if not isinstance(wp, dict):
            raise MissionError(f"waypoint {i} must be an object")
        x = _finite(wp.get("x"), f"waypoint {i}.x")
        y = _finite(wp.get("y"), f"waypoint {i}.y")
        z = _finite(wp.get("z"), f"waypoint {i}.z")
        if z > -MIN_UP_M:
            raise MissionError(f"waypoint {i} is at/below ground (z={z}, ned z is down)")
        hold_s = _finite(wp.get("hold_s", 0.0), f"waypoint {i}.hold_s")
        if hold_s < 0:
            raise MissionError(f"waypoint {i}.hold_s is negative")
        parsed.append({"x": x, "y": y, "z": z, "hold_s": hold_s})

    rate_hz = _finite(body.get("rate_hz", DEFAULT_RATE_HZ), "rate_hz")
    if not MIN_RATE_HZ <= rate_hz <= MAX_RATE_HZ:
        raise MissionError(f"rate_hz must be within {MIN_RATE_HZ}..{MAX_RATE_HZ}")

    takeoff_z = _finite(body.get("takeoff_z", DEFAULT_TAKEOFF_Z), "takeoff_z")
    if takeoff_z > -MIN_UP_M:
        raise MissionError(f"takeoff_z is at/below ground (z={takeoff_z})")

    return {
        "name": name,
        "waypoints": parsed,
        "rate_hz": rate_hz,
        "takeoff_z": takeoff_z,
        "return_to_origin": bool(body.get("return_to_origin", True)),
    }


def mission_steps(
    plan: dict[str, Any], x0: float, y0: float
) -> list[dict[str, Any]]:
    """flat step list from the activation position: climb, waypoints, return.

    each step: kind (takeoff|waypoint|return), index (waypoint number or
    None), target (x, y, z), hold_s.
    """
    steps: list[dict[str, Any]] = [
        {
            "kind": "takeoff",
            "index": None,
            "target": (x0, y0, plan["takeoff_z"]),
            "hold_s": 0.0,
        }
    ]
    for i, wp in enumerate(plan["waypoints"]):
        steps.append(
            {
                "kind": "waypoint",
                "index": i,
                "target": (wp["x"], wp["y"], wp["z"]),
                "hold_s": wp["hold_s"],
            }
        )
    if plan["return_to_origin"]:
        steps.append(
            {
                "kind": "return",
                "index": None,
                "target": (x0, y0, plan["takeoff_z"]),
                "hold_s": 0.0,
            }
        )
    return steps


def status_json(
    node: str | None, state: str, current_index: int | None, total: int, detail: str
) -> str:
    # the MissionStatus shape from the contract; the api relays it verbatim.
    # node is which executor reported - omitted while the host has none.
    body: dict[str, Any] = {}
    if node is not None:
        body["node"] = node
    body.update(
        {"state": state, "current_index": current_index, "total": total, "detail": detail}
    )
    return json.dumps(body)
