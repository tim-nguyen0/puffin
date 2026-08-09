# Flying missions

The Mission Planner screen (`/mission-planner`) builds a NED waypoint
list in a 3D map and hands it to a lifecycle node to fly. It opens with
the 10 m square from the demo, editable in place.

## The 3D map

Waypoints are markers you drag directly:

- **Drag** moves a marker across the north/east plane at its current
  altitude.
- **Shift+drag** moves it in altitude instead — the plane pivots to
  face the camera so the pointer tracks height, not position.

Both gestures snap to 0.1 m and refuse to plant a marker at or below
the pad; the lowest a waypoint can go is 1 m up.

**z is down.** The altitude field is labeled "Z · Down" for a reason —
NED is PX4's frame, so 5 m up is entered as `z: -5`, not `5`. The scene
mirrors this: drag a marker higher and its z value gets *more
negative*. A stalk from the ground to each marker is the only depth
cue, since the grid itself is flat.

The path drawn through the scene is the whole flight: pad → climb to
**Takeoff Z** → each waypoint in order → back to the climb point if
**Return to origin** is on.

## Prime Mission

The builder panel is the source of truth for what actually flies:

| Field | Meaning |
| --- | --- |
| Mission name | the ROS node name for this plan's executor — `^[a-z][a-z0-9_]{0,30}$` |
| Setpoint rate (Hz) | how fast the executor streams setpoints once flying (2–100) |
| Takeoff Z | climb-out altitude, NED down, before the first waypoint |
| Waypoint hold (s) | optional loiter at that waypoint before advancing |

**Prime Mission** posts the plan to `POST /mission`, which latches it
on a transient-local ROS topic. `mission_node` — the host process that
owns every primed plan — picks it up and builds (or rebuilds) a
lifecycle executor named after the plan, configured straight to
`inactive` so the API only ever has to send `activate`.

Priming a name that's already primed **rebuilds** that executor around
the new plan. If the existing one is mid-flight, the rebuild is
refused outright — tearing down an active node would cut its setpoint
stream mid-air. Deactivate it first, then re-prime.

Priming is not the only way to get a plan onto the stack: **Create
Node** turns the same plan into a standalone package instead of an
in-process executor — see [forging a node](/guide/forge).

## Flying it

The **Control Panel** targets one lifecycle node at a time, picked
from the **Executor node** dropdown (auto-discovered the same way the
ROS Nodes screen finds them — anything exposing a
`lifecycle_msgs/srv/ChangeState` service). It defaults to whatever you
most recently primed.

Three buttons, one per lifecycle edge:

- **Arm** — `configure`, unconfigured → inactive. Sets up publishers
  and subscriptions; doesn't touch the vehicle.
- **Run** — `activate`, inactive → active. This is the one with a side
  effect: it calls `POST /vehicle/arm` first, *then* activates the
  node. The node itself streams ~1.2 s of setpoints before requesting
  OFFBOARD mode (gotcha #4 in the README) — Run doesn't skip that
  warmup, it just kicks it off.
- **Stop** — `deactivate` (active → inactive) or `cleanup` (inactive →
  unconfigured), whichever the current state allows.

The map and the waypoint list track the flying executor live: the
active waypoint highlights, and each row picks up a tone (flying,
holding, done) straight from `GET /mission`'s `MissionStatus`.

## Abort

Stopping an active node **deactivates** it. `on_deactivate` commands
PX4 into `AUTO.LOITER` before it stops streaming setpoints — the
vehicle holds position in place rather than falling back to whatever
manual input last existed. It does not land. **Land** (vehicle
control, not this panel) is still the escape hatch if you want it on
the ground.
