# Architecture

Three docker services sharing one network namespace, so everything
talks over loopback:

- **sim** — Gazebo Harmonic (headless physics + a viewport GUI), PX4
  SITL attached standalone, the uXRCE-DDS agent, autonomy packages
  under supervisord, noVNC streaming the viewport.
- **api** — FastAPI with *native* rclpy (built from the ROS image; no
  IPC bridge). Adapters wrap each external system — supervisor, ROS,
  gz — and never leak raw exceptions.
- **web** — the React app behind nginx, which proxies the api and
  websockets on a single origin.

## The channels

| Channel | Carries | Never carries |
| --- | --- | --- |
| noVNC (:6080) | pixels — the full Gazebo viewport | data |
| telemetry websocket | numbers — position, attitude, mode, battery | pixels |
| `/fmu/in/vehicle_command` | arm, takeoff, land | flight behavior |
| lifecycle nodes streaming setpoints | flight behavior | one-shot commands |
| `gz service` | world control (reset, poses) | vehicle commands |

The dashboard's 3D scene renders **client-side** from the telemetry
websocket — the drone's pose and attitude drawn in three.js at
kilobits per second, no video involved.

## The contract

`packages/contract/openapi.yaml` is the source of truth. Endpoints are
edited contract-first: schema, generated types, MSW fixtures, then
implementation — one commit. CI fails on drift.

## The gotchas that fail silently

1. `/fmu/out/*` subscriptions need best-effort + transient-local QoS.
2. `PX4_REF` and `PX4_MSGS_REF` must be the same release — drift means
   topics list but never publish.
3. Offboard mode needs setpoints streaming *before* the mode request.
4. NED: z is down. 5 m up is `z: -5`.

When something misbehaves, walk the README's debugging ladder — each
rung isolates one layer, and "topics exist but no data" is gotcha #1 or
#2 before it is anything else.
