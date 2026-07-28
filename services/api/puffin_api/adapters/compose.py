"""Wrapper around the docker compose CLI. The only place that shells out to compose."""

import json
import subprocess

from . import AdapterResult


class ComposeAdapter:
    def __init__(self, project_dir: str = ".") -> None:
        self._project_dir = project_dir

    def ps(self) -> AdapterResult:
        try:
            out = subprocess.run(
                ["docker", "compose", "ps", "--format", "json"],
                cwd=self._project_dir,
                capture_output=True,
                text=True,
                timeout=10,
                check=True,
            ).stdout
        except Exception as exc:  # noqa: BLE001 - clean {ok, detail} at the boundary
            return AdapterResult(ok=False, detail=f"docker compose unavailable: {exc}")
        services = [json.loads(line) for line in out.splitlines() if line.strip()]
        return AdapterResult(ok=True, data=services)
