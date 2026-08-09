# Adding a ROS package

Drop any ROS 2 Jazzy package (python or c++, `package.xml` required)
into `sim/packages/`, then:

```bash
docker compose up -d --build sim && docker compose up -d --force-recreate api web
```

colcon discovers and builds it automatically; `px4_msgs` stays in its
own cached layer, so your edits rebuild in seconds.

## What you get for free

- **Lifecycle nodes appear in the UI** — ROS Nodes screen, full
  state-machine controls, graph edges — with zero frontend changes.
- `px4_msgs` is pre-built in the workspace: talking to the drone costs
  one `<depend>` line.
- The gentlest flight API needs no PX4 bindings at all: publish a
  `geometry_msgs/Twist` to `/puffin/teleop/cmd_vel` with `/teleop`
  active, and the teleop node's clamps and deadman wrap your commands.

## House rules

1. Subscriptions to `/fmu/out/*` need the shared best-effort QoS
   profile — the default reliable QoS matches nothing and fails
   silently.
2. One setpoint streamer at a time: `/offboard_demo`, `/teleop`, and
   your node fight if simultaneously active.
3. Dependencies beyond ros-base need an `apt-get` line in
   `sim/Dockerfile` — there is no rosdep step.
