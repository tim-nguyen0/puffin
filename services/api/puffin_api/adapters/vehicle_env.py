"""Wrapper around the airframe override file px4 boots with.

Same transport as the forge: a file under the /dev/shm dir the api shares with
the sim container (compose gives them one ipc namespace). sim/supervisord.conf
sources this file before exec'ing px4, so the vars here beat the [program:px4]
defaults and decide which model PX4_GZ_STANDALONE spawns into the world.
"""

import os
from pathlib import Path

from . import AdapterResult

DEFAULT_VEHICLE_ENV = "/dev/shm/puffin/vehicle.env"

# the airframes actually baked into our px4 ref, model -> SYS_AUTOSTART id
# (verified against init.d-posix/airframes in the sim image). server truth:
# anything not in here has no autostart to boot and is refused.
AIRFRAMES = {
    "x500": 4001,
    "x500_depth": 4002,
    "rc_cessna": 4003,
    "standard_vtol": 4004,
    "x500_vision": 4005,
    "px4vision": 4006,
    "advanced_plane": 4008,
    "r1_rover": 4009,
    "x500_mono_cam": 4010,
    "lawnmower": 4011,
    "omnicopter": 8011,
}

# what [program:px4] boots with when no override file exists
BOOT_MODEL = "x500"


class VehicleEnvAdapter:
    def __init__(self, path: str | None = None) -> None:
        self._path = Path(path or os.environ.get("PUFFIN_VEHICLE_ENV", DEFAULT_VEHICLE_ENV))

    def current_model(self) -> str:
        """The model px4 boots with. Never raises: an unreadable or absent
        override just means the image default."""
        try:
            raw = self._path.read_text() if self._path.exists() else ""
        except OSError:
            return BOOT_MODEL
        for line in raw.splitlines():
            key, _, value = line.partition("=")
            if key.strip() == "PX4_SIM_MODEL":
                model = value.strip().removeprefix("gz_")
                if model in AIRFRAMES:
                    return model
        return BOOT_MODEL

    def select(self, model: str) -> AdapterResult:
        airframe = AIRFRAMES.get(model)
        if airframe is None:
            return AdapterResult(ok=False, detail=f"{model} is not baked into this px4 image")
        body = f"PX4_SYS_AUTOSTART={airframe}\nPX4_SIM_MODEL=gz_{model}\n"
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            # write beside it then rename: px4 may be sourcing this file at any
            # moment and must never see half of it
            tmp_path = self._path.with_name(f".{self._path.name}.tmp")
            tmp_path.write_text(body)
            os.replace(tmp_path, self._path)
        except Exception as exc:  # noqa: BLE001 - clean {ok, detail} at the boundary
            return AdapterResult(ok=False, detail=f"vehicle env write failed: {exc}")
        return AdapterResult(ok=True, detail=f"{model} selected (SYS_AUTOSTART {airframe})")
