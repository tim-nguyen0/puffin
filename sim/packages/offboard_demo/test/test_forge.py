# run with `python3 -m pytest` from sim/packages/offboard_demo — forge is pure
# python, no ros needed. it renders a package it can never build here, so the
# checks are: does the output parse, and does it carry the right name and plan.
import ast
import json
import xml.etree.ElementTree as ET

import pytest
from offboard_demo.forge import (
    render_package,
    render_supervisord_conf,
    validate_forge_name,
)
from offboard_demo.mission_plan import MissionError, parse_mission


def plan(name: str = "survey_2") -> dict:
    return parse_mission(
        json.dumps(
            {
                "name": name,
                "waypoints": [
                    {"x": 10.0, "y": 0.0, "z": -5.0},
                    {"x": 10.0, "y": 10.0, "z": -5.0, "hold_s": 4.0},
                ],
                "rate_hz": 20,
                "takeoff_z": -3.0,
                "return_to_origin": False,
            }
        )
    )


def test_render_emits_a_whole_ament_python_package() -> None:
    files = render_package(plan())
    assert set(files) == {
        "package.xml",
        "setup.py",
        "setup.cfg",
        "resource/survey_2",
        "survey_2/__init__.py",
        "survey_2/node.py",
    }
    # ros2 run resolves console scripts out of lib/<package>
    assert "script_dir=$base/lib/survey_2" in files["setup.cfg"]


def test_rendered_python_parses() -> None:
    files = render_package(plan())
    ast.parse(files["survey_2/node.py"])
    ast.parse(files["setup.py"])


def test_setup_py_declares_the_console_script() -> None:
    setup_py = render_package(plan())["setup.py"]
    assert 'package_name = "survey_2"' in setup_py
    assert '"survey_2 = survey_2.node:main"' in setup_py


def test_node_carries_the_name_and_the_plan_verbatim() -> None:
    expected = plan()
    module: dict = {}
    # the generated node only imports pure offboard_demo modules, so it runs
    # here exactly as it would in the container
    exec(render_package(expected)["survey_2/node.py"], module)  # noqa: S102
    assert module["NAME"] == "survey_2"
    assert parse_mission(module["PLAN_JSON"]) == expected
    assert callable(module["main"])


def test_node_reuses_the_shared_executor_rather_than_its_own_flight_code() -> None:
    node_py = render_package(plan())["survey_2/node.py"]
    assert "from offboard_demo.mission_node import run_executor" in node_py
    # anything px4-shaped in here would be a second copy of the flight logic
    assert "TrajectorySetpoint" not in node_py


def test_package_xml_names_the_package_and_its_deps() -> None:
    root = ET.fromstring(render_package(plan())["package.xml"])
    assert root.findtext("name") == "survey_2"
    deps = {node.text for node in root.findall("exec_depend")}
    assert deps == {"offboard_demo", "rclpy", "px4_msgs", "std_msgs"}
    assert root.find("export").findtext("build_type") == "ament_python"


def test_resource_marker_is_named_after_the_package() -> None:
    files = render_package(plan("orbit"))
    assert files["resource/orbit"] == ""
    assert files["orbit/__init__.py"] == ""


@pytest.mark.parametrize(
    "name", ["Bad-Name", "1abc", "a" * 40, "", "has space", "_lead", "orbit\n", 7, None]
)
def test_invalid_names_are_refused(name) -> None:
    with pytest.raises(MissionError):
        validate_forge_name(name)


@pytest.mark.parametrize(
    "name",
    [
        "px4",
        "gz_server",
        "xrce_agent",
        "api",
        "web",
        "qgc",
        "mission",
        "mission_host",
        "teleop",
        "offboard_demo",
        "node_forge",
        "rclpy",
        "std_msgs",
        "px4_msgs",
        # a package on PYTHONPATH shadows the stdlib for the whole container
        "json",
        "socket",
    ],
)
def test_reserved_names_are_refused(name) -> None:
    with pytest.raises(MissionError):
        validate_forge_name(name)
    with pytest.raises(MissionError):
        render_package(plan(name))


def test_reserved_set_is_overridable() -> None:
    assert validate_forge_name("mission", reserved=()) == "mission"


def test_supervisord_block_runs_the_forged_entry_point() -> None:
    conf = render_supervisord_conf("survey_2")
    assert conf.startswith("[program:survey_2]")
    assert "ros2 run survey_2 survey_2" in conf
    assert "source /ros_ws/install/setup.bash" in conf
    # first build flies once on its own
    assert "autostart = true" in conf


def test_supervisord_block_reads_a_finished_mission_as_a_clean_exit() -> None:
    # the node autokills with 0 once the plan is flown; unconditional
    # autorestart would respawn it into the same flight forever
    conf = render_supervisord_conf("survey_2")
    assert "autorestart = unexpected" in conf
    assert "exitcodes = 0" in conf
    assert "autorestart = true" not in conf


def test_forged_node_advertises_its_one_shot_lifetime() -> None:
    node_py = render_package(plan())["survey_2/node.py"]
    assert "one-shot" in node_py
    assert "supervisorctl start survey_2" in node_py


def test_supervisord_block_refuses_a_bad_name() -> None:
    with pytest.raises(MissionError):
        render_supervisord_conf("gz-gui")
