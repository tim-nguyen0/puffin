# QGroundControl

The sim streams MAVLink to the docker host on UDP 14550 — exactly where
a locally installed QGroundControl listens. Open QGC and it connects
itself: map, instruments, parameters, missions, against the same
simulated vehicle the Puffin UI flies.

No configuration, no port mapping — the link is outbound from the
container. On hosts without `host.docker.internal` (plain Linux docker),
the link skips gracefully; add the `host-gateway` extra host to enable
it.

Two notes:

- QGC is a third control channel beside the Puffin UI and offboard
  nodes. Everything stays consistent — the dashboard reflects whatever
  QGC commands — but the one-pilot rule now spans tools.
- Cloud deployments can't carry this link: the tunnel path is HTTP-only.
  QGC is a local (or future VPS) feature.
