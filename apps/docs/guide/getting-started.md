# Getting started

## Prerequisites

- Docker Desktop with ~8 GB RAM and ~25 GB free disk
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
| http://localhost:5173 | the app — login, dashboard, simulation, ros nodes, graph |
| http://localhost:6080 | full-size Gazebo viewport (also embedded in the Simulation page) |
| http://localhost:8000/docs | the API, interactive |

Create an account on the launch page and you land on the dashboard:
live 3D scene, telemetry, process rail, control panel.

## Frontend development

```bash
pnpm dev        # vite + MSW mock api, hot reload - no docker needed
```

Stop the web container first (`docker compose stop web`) — both want
port 5173, and serving confusion between the two has burned real
debugging hours. `curl -s localhost:5173 | head -3` tells you which is
answering: hashed assets = container, plain = vite.
