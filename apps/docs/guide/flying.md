# Flying the demo

The demo: activate the `offboard_demo` lifecycle node and the drone
flies a 10 m square.

## From the dashboard

1. **Arm** → **Takeoff** (the altitude field is meters above ground)
2. In the **Lifecycle Nodes** card, **Activate** `/offboard_demo`
3. Watch the square in the Simulation View; the node holds the start
   corner when done
4. **Stop** the node, then **Land**

While an offboard node is in control, manual controls gray out — the
status strip says who is flying. **Land stays live** as the escape
hatch; it overrides offboard by design.

## Fly your own plan

`offboard_demo` flies one fixed square — for anything else, the
[mission planner](/guide/missions) builds a NED waypoint list in a 3D
map and flies it through its own lifecycle node, with the same
arm → run → stop controls and the same deactivate-to-loiter abort as
above. Plans built there can also be turned into a standalone node —
see [forging a node](/guide/forge) — so a one-off flight and a
permanent addition to the stack start from the same builder.

## Manual flight

Activate `/teleop` instead, arm, and either hold the directional pad
buttons or plug in a game controller (Xbox/PS — press any button so the
browser exposes it, then tick **Fly with controller**). Left stick
climbs and yaws, right stick translates north/east. A 0.5 s deadman
hovers the drone if your connection - or attention - lapses.

## From a terminal, if you must

```bash
curl -X POST localhost:8000/api/vehicle/arm
curl -X POST localhost:8000/api/vehicle/takeoff \
  -H 'content-type: application/json' -d '{"altitude_m": 5}'
curl -X POST localhost:8000/api/ros/lifecycle/offboard_demo/transition \
  -H 'content-type: application/json' -d '{"transition": "activate"}'
```
