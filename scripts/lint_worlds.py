#!/usr/bin/env python3
"""Lint sim worlds per CLAUDE.md gotcha #6: every .sdf needs all 8 sensor
system plugins + <spherical_coordinates>, and must never share a filename
with a PX4-shipped world."""

import sys
from pathlib import Path

REQUIRED_PLUGINS = (
    "gz::sim::systems::Physics",
    "gz::sim::systems::UserCommands",
    "gz::sim::systems::SceneBroadcaster",
    "gz::sim::systems::Sensors",
    "gz::sim::systems::Imu",
    "gz::sim::systems::Magnetometer",
    "gz::sim::systems::AirPressure",
    "gz::sim::systems::NavSat",
)

PX4_SHIPPED_WORLDS = frozenset(
    {"default", "aruco", "baylands", "lawn", "rover", "walls", "warehouse", "windy", "moon"}
)


def lint(world: Path) -> list[str]:
    errors: list[str] = []
    if world.stem in PX4_SHIPPED_WORLDS:
        errors.append(f"filename collides with PX4-shipped world '{world.stem}'")
    text = world.read_text()
    errors.extend(f"missing plugin {plugin}" for plugin in REQUIRED_PLUGINS if plugin not in text)
    if "<spherical_coordinates>" not in text:
        errors.append("missing <spherical_coordinates>")
    return errors


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: lint_worlds.py <worlds-dir>", file=sys.stderr)
        return 2
    worlds = sorted(Path(sys.argv[1]).glob("*.sdf"))
    failed = False
    for world in worlds:
        for error in lint(world):
            print(f"{world}: {error}", file=sys.stderr)
            failed = True
    print(f"checked {len(worlds)} world(s): {'FAIL' if failed else 'ok'}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
