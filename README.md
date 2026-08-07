# Puffin

Browser-based control plane for a PX4 + Gazebo drone simulation. Three Docker
services — `sim` (Gazebo Harmonic, PX4 SITL, Micro XRCE-DDS agent, noVNC),
`api` (FastAPI with native rclpy), `web` (React) — share one network
namespace, so everything talks over loopback. The demo: activate the
`offboard_demo` lifecycle node and the drone flies a 10 m square.

## Prerequisites

- Docker Desktop with ~8 GB RAM and ~25 GB free disk (the sim image is big)
- Node 22 + pnpm (only for frontend development outside Docker)

## Quick start

```bash
docker compose build sim     # first build ~40-70 min (PX4 compile); cached after
make up                      # start sim + api + web
make procs                   # wait until every program shows RUNNING
```

Then open:

| URL | What |
| --- | --- |
| http://localhost:5173 | the app — launcher on `/`, dashboard, ros-services, ros-graph |
| http://localhost:6080 | full-size noVNC Gazebo viewport (also embedded in the dashboard) |
| http://localhost:8000/docs | the API, interactive |

## Fly the demo

From the dashboard: **Arm** → **Takeoff (5 m)** → activate `offboard_demo`
(ros-services screen). The drone flies a 10 m square in the viewport and
holds the start corner. Deactivate hands PX4 back to loiter; **Land** brings
it down.

The same thing over curl:

```bash
curl -X POST localhost:8000/api/vehicle/arm
curl -X POST localhost:8000/api/vehicle/takeoff \
  -H 'content-type: application/json' -d '{"altitude_m": 5}'
sleep 10
curl -X POST localhost:8000/api/ros/lifecycle/offboard_demo/transition \
  -H 'content-type: application/json' -d '{"transition": "activate"}'
# square flies; then:
curl -X POST localhost:8000/api/ros/lifecycle/offboard_demo/transition \
  -H 'content-type: application/json' -d '{"transition": "deactivate"}'
curl -X POST localhost:8000/api/vehicle/land
```

Shut down with `make down`.

## Frontend development (no Docker)

```bash
pnpm install
pnpm dev        # Vite + MSW mock API on :5173, hot reload
```

Stop the web container first (`docker compose stop web`) — both want 5173.
The embedded viewport and terminal show connection errors in mock mode;
everything else works against the MSW fixtures.

## Tests

```bash
pnpm typecheck && pnpm lint && pnpm test    # web
cd services/api && pytest                   # api (fake adapters, no ros needed)
python3 scripts/lint_worlds.py sim/worlds   # world sanity
cd sim/packages/offboard_demo && python3 -m pytest   # square-flight geometry
```

## Adding your own ROS package

Drop the package into `sim/packages/` (anything with a `package.xml` -
python or c++), then:

```bash
docker compose up -d --build sim && docker compose up -d --force-recreate api web
```

colcon discovers and builds it automatically. Lifecycle nodes appear on
the ROS Nodes screen with full controls, no frontend changes; add a
supervisord program if it should autostart. Two rules of the house:
subscriptions to `/fmu/out/*` need the shared best-effort QoS profile or
they silently receive nothing, and only one node should stream setpoints
at a time.

## When something doesn't work

Work top to bottom; each rung isolates one layer. Stop at the first rung that
fails — everything below it is noise until it passes. `make doctor` covers
most of these in one shot.

1. **Browser :6080** — noVNC shows the Gazebo viewport. No picture → the sim
   container or X stack is down (`make procs`).
2. **`gz topic -l` has `/clock`** — the physics server is publishing.
   Missing → `gz sim -s` isn't running or the world failed to load.
3. **`make procs`** — every program RUNNING. BACKOFF/FATAL → read that
   program's log (`make logs`).
4. **PX4 prints "Ready for takeoff!"** — PX4 attached to the running world.
   Missing → check `PX4_GZ_STANDALONE` wiring.
5. **Topic data flows** — `ros2 topic hz` on a `/fmu/out/*` topic inside the
   sim container. Topics list but no data → QoS mismatch or `PX4_REF` /
   `PX4_MSGS_REF` drift (see CLAUDE.md gotchas #1 and #2) before anything
   else.
6. **Fly `dummy_flight square`** — end-to-end PX4 command path, no api:
   ```bash
   docker compose exec sim bash -lc \
     "source /ros_ws/install/setup.bash && ros2 run offboard_demo dummy_flight square"
   ```
   Arms, climbs, flies the square, lands, exits 0.
7. **The api-driven demo** (above) — rung 6 passing but 7 failing means the
   api layer, not the sim.

Arming intermittently rejected with "Yaw estimate error" usually means the
host is starved: the sim clock stutters and the EKF spikes. Close what you
can, or stop the disposable viewport (`docker compose exec sim supervisorctl
stop gz-gui`) to buy physics headroom.
