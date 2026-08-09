---
layout: home

hero:
  name: Puffin
  text: A browser control plane for drone simulation
  tagline: PX4 + Gazebo + ROS 2, flown from a web page. No terminals, no 70-minute setups, no lost camera angles.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Visual style
      link: /style

features:
  - title: One-click simulation
    details: The whole stack — physics, PX4 SITL, the DDS bridge, autonomy nodes — starts from a button and reports its health on a live process rail.
  - title: Fly it three ways
    details: Autonomous lifecycle nodes, hold-to-fly teleop with a game controller, or QGroundControl connecting itself over MAVLink.
  - title: See everything live
    details: A client-side 3D scene driven by telemetry, the full Gazebo viewport when you want ground truth, and the real ROS graph with publish/subscribe edges.
  - title: Bring your own package
    details: Drop any ROS 2 Jazzy package into sim/packages/ and it builds into the image. Lifecycle nodes appear in the UI with full controls, automatically.
---
