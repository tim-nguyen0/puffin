# QGroundControl

Two ways to put a real GCS on the same simulated vehicle the Puffin UI
flies.

## Embedded

The `qgc` compose service runs QGroundControl headless, and the
dashboard shows its display on `:6081` — right next to the Gazebo
viewport — over the same noVNC pixel path, not the telemetry
websocket. Bring it up with the rest of the stack:

```bash
docker compose up -d --build qgc
```

QGC ships no arm64 build, so the service is pinned `linux/amd64`. On
Apple silicon, Rosetta emulates *just this one container* — physics
and PX4 stay native, only the GCS runs translated. If the dashboard's
QGC panel shows a disconnected stream, that's usually the container
not up yet (`docker compose up -d qgc`), not a QGC crash.

## Desktop

The sim also streams MAVLink to the docker host on UDP 14550 — exactly
where a locally installed QGroundControl listens. Open QGC and it
connects itself: map, instruments, parameters, missions, against the
same simulated vehicle.

No configuration, no port mapping — the link is outbound from the
container. On hosts without `host.docker.internal` (plain Linux docker),
the link skips gracefully; add the `host-gateway` extra host to enable
it.

## Two notes either way

- QGC — embedded or desktop — is a control channel beside the Puffin
  UI and offboard nodes. Everything stays consistent — the dashboard
  reflects whatever QGC commands — but **the one-pilot rule now spans
  tools**: only one thing should be commanding the vehicle at a time,
  whichever window it's in.
- Cloud deployments can't carry either link: the tunnel/proxy path is
  HTTP-only. QGC (embedded or desktop) is a local — or future VPS —
  feature.
