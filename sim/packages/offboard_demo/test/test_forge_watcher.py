# run with `python3 -m pytest` from sim/packages/offboard_demo. the build and
# supervisorctl legs need the container; what is testable here is the part the
# api depends on — every spec ends in a result file, and a spec is only rebuilt
# when it changes.
import json
import os
from pathlib import Path

import pytest
from offboard_demo import forge_watcher


@pytest.fixture(autouse=True)
def forge_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(forge_watcher, "FORGE_DIR", tmp_path)
    return tmp_path


def write_spec(forge_dir, name: str, body) -> Path:
    spec = forge_dir / f"{name}.json"
    spec.write_text(body if isinstance(body, str) else json.dumps(body))
    return spec


def result(forge_dir, name: str) -> dict:
    return json.loads((forge_dir / f"{name}.result.json").read_text())


def test_a_bad_plan_fails_before_anything_is_built(forge_dir, monkeypatch) -> None:
    monkeypatch.setattr(
        forge_watcher, "run", lambda *a, **k: pytest.fail("must not build")
    )
    spec = write_spec(forge_dir, "survey", {"waypoints": []})
    forge_watcher.forge(spec, "survey")
    reported = result(forge_dir, "survey")
    assert reported["name"] == "survey"
    assert reported["state"] == "failed"
    assert reported["detail"]


def test_a_spec_must_agree_with_its_filename(forge_dir, monkeypatch) -> None:
    monkeypatch.setattr(
        forge_watcher, "run", lambda *a, **k: pytest.fail("must not build")
    )
    spec = write_spec(
        forge_dir, "survey", {"name": "orbit", "waypoints": [{"x": 1, "y": 2, "z": -5}]}
    )
    forge_watcher.forge(spec, "survey")
    assert result(forge_dir, "survey")["state"] == "failed"


def test_names_that_are_not_forgeable_never_reach_a_path(forge_dir) -> None:
    assert forge_watcher.spec_name(forge_dir / "Survey Two.json") is None
    assert forge_watcher.spec_name(forge_dir / "survey_2.json") == "survey_2"
    # a name that is only reserved is still safe to answer on
    assert forge_watcher.spec_name(forge_dir / "px4.json") is None
    assert result(forge_dir, "px4")["state"] == "failed"
    # one that isn't a name at all has nowhere safe to write a result
    assert not list(forge_dir.glob("Survey*"))


def test_sweep_builds_once_per_rewrite(forge_dir, monkeypatch) -> None:
    built: list[str] = []
    monkeypatch.setattr(forge_watcher, "forge", lambda spec, name: built.append(name))
    spec = write_spec(forge_dir, "survey", {"waypoints": [{"x": 1, "y": 2, "z": -5}]})
    # a result file sitting next to the spec is not itself a spec
    forge_watcher.write_result("survey", "done", "built earlier")

    seen: dict[str, float] = {}
    forge_watcher.sweep(seen)
    forge_watcher.sweep(seen)
    assert built == ["survey"]

    # re-forged: same name, new content, new mtime
    spec.write_text(json.dumps({"waypoints": [{"x": 9, "y": 9, "z": -9}]}))
    os.utime(spec, (0, 0))
    forge_watcher.sweep(seen)
    assert built == ["survey", "survey"]


def test_sweep_survives_a_spec_that_explodes(forge_dir, monkeypatch) -> None:
    def boom(spec, name):
        raise RuntimeError("colcon ate the disk")

    monkeypatch.setattr(forge_watcher, "forge", boom)
    write_spec(forge_dir, "survey", {"waypoints": [{"x": 1, "y": 2, "z": -5}]})
    forge_watcher.sweep({})
    assert result(forge_dir, "survey")["state"] == "failed"


def test_build_only_sources_the_base_ros_env() -> None:
    # sourcing /ros_ws/install while building into /ros_ws is what colcon
    # warns about, and offboard_demo is a runtime dep of the forged node
    command = forge_watcher.build_command("survey")
    assert "colcon build --symlink-install --packages-select survey" in command
    assert "/ros_ws/install/setup.bash" not in command


def test_a_re_forged_node_is_asked_to_loiter_before_it_is_restarted() -> None:
    command = forge_watcher.deactivate_command("survey")
    assert "ros2 lifecycle set /survey deactivate" in command
    assert "source /ros_ws/install/setup.bash" in command


def test_write_tree_drops_the_previous_render(tmp_path) -> None:
    root = tmp_path / "survey"
    forge_watcher.write_tree(root, {"survey/node.py": "old", "stale.txt": "x"})
    forge_watcher.write_tree(root, {"survey/node.py": "new"})
    assert (root / "survey/node.py").read_text() == "new"
    assert not (root / "stale.txt").exists()


def test_results_are_written_atomically(forge_dir) -> None:
    forge_watcher.write_result("survey", "building", "spec picked up")
    assert result(forge_dir, "survey")["state"] == "building"
    # no half-written leftovers for the api to trip over
    assert [p.name for p in forge_dir.iterdir()] == ["survey.result.json"]
