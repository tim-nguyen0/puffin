"""turns mission specs dropped on /dev/shm into supervised ros packages.

the api and sim containers share an ipc namespace (see docker-compose), so
/dev/shm is one filesystem across both. the api writes <name>.json there
atomically - the MissionRequest body verbatim - and this loop renders a
package around it, colcon-builds it into the workspace, drops a supervisord
program block and lets supervisord start it.

<name>.result.json is the only channel back to the api, so every path through
here ends in a result file: a traceback the api never sees would leave a spec
stuck on "building" forever. the loop itself must never die - supervisord
would restart it, but the in-flight spec's result would be lost.
"""

import json
import os
import shutil
import subprocess
import time
from pathlib import Path

from .forge import render_package, render_supervisord_conf, validate_forge_name
from .mission_plan import NAME_RE, MissionError, parse_mission

FORGE_DIR = Path(os.environ.get("PUFFIN_FORGE_DIR", "/dev/shm/puffin/forge"))
WORKSPACE = Path(os.environ.get("PUFFIN_ROS_WS", "/ros_ws"))
ROS_DISTRO = os.environ.get("ROS_DISTRO", "jazzy")
SUPERVISORD_CONF = "/etc/supervisor/supervisord.conf"
CONF_DIR = Path("/etc/supervisor/conf.d")
# the repo's sim/packages bind mount when compose provides it: a copy here
# outlives the container, so the next image build bakes the node in
PERSIST_DIR = Path("/persist/packages")

SPEC_SUFFIX = ".json"
RESULT_SUFFIX = ".result.json"
POLL_S = 1.0
BUILD_TIMEOUT_S = 600.0
CTL_TIMEOUT_S = 120.0
# enough of a colcon failure to name the cause without flooding the result
TAIL_LINES = 12


def log(message: str) -> None:
    print(f"forge: {message}", flush=True)


def _write_atomic(path: Path, text: str) -> None:
    # same-dir tmp + rename, mirroring how the api writes specs: a reader
    # never sees half a file
    tmp = path.with_name(f".{path.name}.tmp")
    tmp.write_text(text)
    os.replace(tmp, path)


def write_result(name: str, state: str, detail: str) -> None:
    body = json.dumps({"name": name, "state": state, "detail": detail})
    _write_atomic(FORGE_DIR / f"{name}{RESULT_SUFFIX}", body)


def run(argv: list[str], timeout: float) -> tuple[bool, str]:
    """subprocess with everything captured. never raises."""
    try:
        done = subprocess.run(
            argv, capture_output=True, text=True, timeout=timeout, check=False
        )
    except subprocess.TimeoutExpired:
        return False, f"timed out after {timeout:.0f}s"
    except OSError as exc:
        return False, str(exc)
    return done.returncode == 0, f"{done.stdout}\n{done.stderr}".strip()


def tail(text: str, lines: int = TAIL_LINES) -> str:
    return "\n".join(text.splitlines()[-lines:]).strip() or "no output"


def deactivate_command(name: str) -> str:
    # best effort before a re-forged node is restarted: on_deactivate hands
    # px4 back to AUTO.LOITER, where dropping the process only loses the
    # setpoint stream px4 has already stopped needing
    return f"source /ros_ws/install/setup.bash && ros2 lifecycle set /{name} deactivate"


def build_command(name: str) -> str:
    # the base ros env only: sourcing the workspace we are about to build
    # into is what colcon warns about, and the forged node's offboard_demo
    # import is a runtime dependency, not a build one
    return (
        f"source /opt/ros/{ROS_DISTRO}/setup.bash && cd {WORKSPACE} && "
        f"colcon build --symlink-install --packages-select {name}"
    )


def write_tree(root: Path, files: dict[str, str]) -> None:
    # from scratch: a re-forge must not leave the last plan's files behind
    if root.exists():
        shutil.rmtree(root)
    for relative, text in sorted(files.items()):
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)


def persist(name: str, source: Path, conf: str) -> None:
    """copy the package into the bind mount so the next image build bakes it in."""
    dest = PERSIST_DIR / name
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(
        source,
        dest,
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "*.egg-info"),
    )
    # the Dockerfile restores this as the package's program block
    (dest / "forge.conf").write_text(conf)


def forge(spec: Path, name: str) -> None:
    """one spec, start to finish. reports every outcome as a result file."""
    write_result(name, "building", "spec picked up")

    try:
        raw = spec.read_text()
    except OSError as exc:
        write_result(name, "failed", f"unreadable spec: {exc}")
        return

    try:
        plan = parse_mission(raw)
        if plan["name"] != name:
            raise MissionError(
                f"spec is named {name} but the plan declares {plan['name']}"
            )
        validate_forge_name(plan["name"])
        files = render_package(plan)
        conf = render_supervisord_conf(name)
    except MissionError as exc:
        write_result(name, "failed", str(exc))
        return

    source = WORKSPACE / "src" / name
    try:
        write_tree(source, files)
    except OSError as exc:
        write_result(name, "failed", f"cannot write {source}: {exc}")
        return

    log(f"building {name} ({len(plan['waypoints'])} waypoints)")
    ok, output = run(["bash", "-lc", build_command(name)], BUILD_TIMEOUT_S)
    if not ok:
        write_result(name, "failed", f"colcon build failed: {tail(output)}")
        return

    if PERSIST_DIR.is_dir():
        try:
            persist(name, source, conf)
        except OSError as exc:
            # the bind mount is a convenience, not the contract - the node
            # already runs without it
            log(f"{name}: not persisted to {PERSIST_DIR}: {exc}")

    conf_path = CONF_DIR / f"{name}.conf"
    # a program block that already existed means supervisord is already
    # running this name; its block doesn't change between forges, so update
    # alone would leave the old plan flying
    relaunch = conf_path.exists()
    try:
        CONF_DIR.mkdir(parents=True, exist_ok=True)
        _write_atomic(conf_path, conf)
    except OSError as exc:
        write_result(name, "failed", f"cannot write the program block: {exc}")
        return

    for verb in ("reread", "update"):
        ok, output = run(["supervisorctl", "-c", SUPERVISORD_CONF, verb], CTL_TIMEOUT_S)
        if not ok:
            write_result(name, "failed", f"supervisorctl {verb} failed: {tail(output)}")
            return

    if relaunch:
        run(["bash", "-lc", deactivate_command(name)], CTL_TIMEOUT_S)
        ok, output = run(
            ["supervisorctl", "-c", SUPERVISORD_CONF, "restart", name], CTL_TIMEOUT_S
        )
        if not ok:
            write_result(name, "failed", f"restart failed: {tail(output)}")
            return

    total = len(plan["waypoints"])
    log(f"{name} built and started")
    write_result(
        name, "done", f"built {name} ({total} waypoints); activate {name} to fly"
    )


def spec_name(spec: Path) -> str | None:
    """the forge name a spec file claims, or None if it isn't usable as one.

    checked before the name reaches any path: only something already shaped
    like a ros name is allowed to steer a write.
    """
    name = spec.name[: -len(SPEC_SUFFIX)]
    if not NAME_RE.fullmatch(name):
        # not a name, so not a safe path either: there is nowhere to report
        log(f"ignoring {spec.name}: not a forge name")
        return None
    try:
        return validate_forge_name(name)
    except MissionError as exc:
        # reserved, but still a name - the api gets told why
        write_result(name, "failed", str(exc))
        return None


def sweep(seen: dict[str, float]) -> None:
    """build every spec that is new or has been rewritten since last sweep."""
    try:
        specs = sorted(FORGE_DIR.glob(f"*{SPEC_SUFFIX}"))
    except OSError as exc:
        log(f"cannot read {FORGE_DIR}: {exc}")
        return

    present = set()
    for spec in specs:
        if spec.name.endswith(RESULT_SUFFIX):
            continue
        present.add(spec.name)
        try:
            mtime = spec.stat().st_mtime
        except OSError:
            continue
        if seen.get(spec.name) == mtime:
            continue
        # remember before building: a rewrite mid-build then differs again
        # and gets rebuilt on the next sweep instead of being swallowed
        seen[spec.name] = mtime
        name = spec_name(spec)
        if name is None:
            continue
        try:
            forge(spec, name)
        except Exception as exc:  # the loop outlives any single bad spec
            log(f"{name} crashed the forge: {exc!r}")
            try:
                write_result(name, "failed", f"forge crashed: {exc}")
            except OSError:
                pass

    # a deleted spec re-appearing with an old mtime is still a new build
    for gone in set(seen) - present:
        del seen[gone]


def main() -> None:
    FORGE_DIR.mkdir(parents=True, exist_ok=True)
    log(f"watching {FORGE_DIR}")
    seen: dict[str, float] = {}
    while True:
        try:
            sweep(seen)
        except Exception as exc:  # never let the watcher exit on a bad sweep
            log(f"sweep failed: {exc!r}")
        time.sleep(POLL_S)


if __name__ == "__main__":
    main()
