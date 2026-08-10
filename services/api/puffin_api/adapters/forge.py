"""Wrapper around the sim-side forge transport: files under a shared /dev/shm dir.

The api only writes a spec and reads back a result; the actual colcon build
happens in a sim-side watcher outside this process (see the /mission/forge
comment in packages/contract/openapi.yaml for the full protocol).
"""

import json
import os
from pathlib import Path

from . import AdapterResult

DEFAULT_FORGE_DIR = "/dev/shm/puffin/forge"


class ForgeAdapter:
    def __init__(self, dir: str | None = None) -> None:
        self._dir = Path(dir or os.environ.get("PUFFIN_FORGE_DIR", DEFAULT_FORGE_DIR))

    def queue_spec(self, name: str, spec_json: str) -> AdapterResult:
        try:
            self._dir.mkdir(parents=True, exist_ok=True)
            # write in the same dir then rename so the watcher never sees a
            # partially written spec mid-write
            tmp_path = self._dir / f".{name}.json.tmp"
            tmp_path.write_text(spec_json)
            os.replace(tmp_path, self._dir / f"{name}.json")
        except Exception as exc:  # noqa: BLE001 - clean {ok, detail} at the boundary
            return AdapterResult(ok=False, detail=f"forge spec write failed: {exc}")
        return AdapterResult(ok=True, detail=f"spec queued for {name}")

    def status(self, name: str) -> AdapterResult:
        result_path = self._dir / f"{name}.result.json"
        try:
            raw = result_path.read_text() if result_path.exists() else None
        except Exception as exc:  # noqa: BLE001 - clean {ok, detail} at the boundary
            return AdapterResult(ok=False, detail=f"forge result unreadable: {exc}")
        if raw is not None:
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError as exc:
                return AdapterResult(ok=False, detail=f"forge result malformed: {exc}")
            return AdapterResult(
                ok=True,
                data={
                    "name": parsed.get("name", name),
                    "state": parsed.get("state", "unknown"),
                    "detail": parsed.get("detail", ""),
                },
            )
        try:
            spec_queued = (self._dir / f"{name}.json").exists()
        except Exception as exc:  # noqa: BLE001 - clean {ok, detail} at the boundary
            return AdapterResult(ok=False, detail=f"forge spec unreadable: {exc}")
        if spec_queued:
            return AdapterResult(
                ok=True,
                data={"name": name, "state": "queued", "detail": "waiting for the sim-side forge"},
            )
        return AdapterResult(
            ok=True,
            data={"name": name, "state": "unknown", "detail": "no forge spec for that name"},
        )
