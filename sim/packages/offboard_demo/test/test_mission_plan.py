# run with `python3 -m pytest` from sim/packages/offboard_demo — mission_plan
# is pure python, no ros needed.
import json

import pytest
from offboard_demo.mission_plan import (
    MissionError,
    mission_steps,
    parse_mission,
    status_json,
)


def plan_json(**overrides) -> str:
    body = {
        "waypoints": [
            {"x": 10.0, "y": 0.0, "z": -5.0},
            {"x": 10.0, "y": 10.0, "z": -5.0, "hold_s": 4.0},
        ],
        "rate_hz": 20,
        "takeoff_z": -3.0,
        "return_to_origin": True,
    }
    body.update(overrides)
    return json.dumps(body)


def test_parse_round_trips_a_valid_mission() -> None:
    plan = parse_mission(plan_json())
    assert len(plan["waypoints"]) == 2
    assert plan["waypoints"][1]["hold_s"] == 4.0
    assert plan["rate_hz"] == 20.0
    assert plan["return_to_origin"] is True


def test_parse_applies_contract_defaults() -> None:
    plan = parse_mission(json.dumps({"waypoints": [{"x": 1, "y": 2, "z": -5}]}))
    assert plan["name"] == "mission"
    assert plan["rate_hz"] == 20.0
    assert plan["takeoff_z"] == -3.0
    assert plan["return_to_origin"] is True
    assert plan["waypoints"][0]["hold_s"] == 0.0


def test_parse_keeps_a_valid_executor_name() -> None:
    assert parse_mission(plan_json(name="survey_2"))["name"] == "survey_2"
    # 31 chars is the ceiling: one letter plus 30
    longest = "a" + "b" * 30
    assert parse_mission(plan_json(name=longest))["name"] == longest


@pytest.mark.parametrize(
    "name",
    ["Bad-Name", "1abc", "a" * 40, "", "has space", "_lead", "mission\n", 7, None],
)
def test_parse_refuses_names_that_are_not_ros_names(name) -> None:
    with pytest.raises(MissionError):
        parse_mission(plan_json(name=name))


def test_parse_refuses_garbage() -> None:
    with pytest.raises(MissionError):
        parse_mission("not json")
    with pytest.raises(MissionError):
        parse_mission(json.dumps({"waypoints": []}))
    with pytest.raises(MissionError):
        parse_mission(json.dumps({"waypoints": [{"x": 0, "y": 0}]}))
    with pytest.raises(MissionError):
        parse_mission(plan_json(rate_hz=0.5))


def test_parse_refuses_underground_waypoints() -> None:
    # ned z is down: positive z is below the floor
    with pytest.raises(MissionError):
        parse_mission(plan_json(waypoints=[{"x": 0, "y": 0, "z": 5.0}]))
    with pytest.raises(MissionError):
        parse_mission(plan_json(takeoff_z=0.0))


def test_steps_climb_first_and_return_last() -> None:
    steps = mission_steps(parse_mission(plan_json()), 1.0, 2.0)
    assert [s["kind"] for s in steps] == ["takeoff", "waypoint", "waypoint", "return"]
    assert steps[0]["target"] == (1.0, 2.0, -3.0)
    assert steps[-1]["target"] == (1.0, 2.0, -3.0)
    assert steps[1]["index"] == 0
    assert steps[2]["hold_s"] == 4.0


def test_steps_skip_return_when_disabled() -> None:
    steps = mission_steps(parse_mission(plan_json(return_to_origin=False)), 0.0, 0.0)
    assert steps[-1]["kind"] == "waypoint"


def test_status_json_matches_the_contract_shape() -> None:
    status = json.loads(status_json("survey_2", "flying", 1, 4, "waypoint 2 of 4"))
    assert status == {
        "node": "survey_2",
        "state": "flying",
        "current_index": 1,
        "total": 4,
        "detail": "waypoint 2 of 4",
    }


def test_status_json_omits_node_when_no_executor_exists() -> None:
    # the host's boot message: nothing has been primed, so node is absent
    status = json.loads(status_json(None, "idle", None, 0, "no mission primed"))
    assert "node" not in status
    assert status["state"] == "idle"
