# Forging a node

**Create Node**, next to **Prime Mission** on the [mission
planner](/guide/missions), takes the same plan and does something
different with it: instead of an in-process executor living inside
`mission_host`, the plan gets its own ROS package, its own `ros2 run`
entry point, and its own supervisord program. A forged node survives a
host restart and shows up in `supervisorctl status` like any other
process — because it *is* one.

## How it works

The api and sim containers share an IPC namespace, which makes
`/dev/shm` one filesystem across both. `POST /mission/forge` writes the
plan to `/dev/shm/puffin/forge/{name}.json` (atomically — temp file,
then rename, so a reader never sees a half-written spec) and returns
immediately: the actual build happens on the sim side, out of band.

A watcher loop on the sim container polls that directory once a
second. For each new or changed spec it:

1. Renders a package around the plan — `package.xml`, `setup.py`,
   `setup.cfg`, and a `node.py` with the plan embedded as JSON.
   Templates substitute a `__FORGE_NAME__` / `__FORGE_PLAN__` sentinel
   rather than `str.format` or `Template`, because the rendered files
   are full of their own braces and `$vars`.
2. Runs a live `colcon build --symlink-install --packages-select {name}`
   in the workspace.
3. Drops a `[program:{name}]` block into supervisord's config
   directory and tells it to `reread` and `update`. On a re-forge —
   a name that already has a block — the old node is deactivated
   first, so PX4 gets a clean loiter instead of a dropped setpoint
   stream, then stopped and started on the new build.

The forged node is deliberately thin: `node.py` imports
`mission_node.run_executor` and hands it the embedded plan, so a
forged node and a plan primed through the builder fly the exact same
flight code. The only difference is who owns the process.

Every path through the watcher ends by writing a result file, so the
build never leaves the api guessing:

```
GET /mission/forge/{name}  →  ForgeStatus { name, state, detail }
```

`state` moves `queued` → `building` → `done` (or `failed`). The
Mission Planner screen polls every 2 s while a build is in flight and
stops once it lands somewhere terminal. `done` means the node exists,
booted to `inactive`, waiting for `activate` — same contract as
`offboard_demo`.

## Persistence

A successful build also copies the finished package into
`sim/packages/` on the host, alongside its supervisord block as
`forge.conf`. That directory is the same one `docker compose build
sim` bakes into the image, so the next rebuild restores both the
package *and* its program block automatically — a forged node outlives
not just a container restart but the image itself. `patrol_demo` in
this repo is a real forged package persisted exactly this way.

## Reserved names

A mission name has to match `^[a-z][a-z0-9_]{0,30}$` to be primed at
all, but forging adds a second check: the name can't collide with
anything the stack already owns. That includes the obvious neighbors —
`px4`, `gz-server`, `gz-gui`, `xrce-agent`, `api`, `web`, `qgc`,
`mission_node`, `teleop`, `offboard_demo`, `forge` itself — and one
less obvious set: **the entire Python standard library**. A forged
package lands on `PYTHONPATH` ahead of the stdlib, so a node named
`json` or `socket` would shadow that module for every Python process
in the container, not just its own. Picking a reserved name fails the
forge with a clear `name %r is reserved by the stack; pick another` —
before anything touches disk.

## Flying a forged node

A forged node is controllable exactly like `offboard_demo`: it appears
in the ROS Nodes screen and in the mission planner's executor dropdown
once the build lands, with the same arm → run → stop controls
described in [flying missions](/guide/missions#flying-it). Stopping it
deactivates the same way, too — PX4 loiters, nothing falls out of the
sky.

## One-shot lifetime

Where a plan primed into `mission_host` holds its last target
indefinitely, a forged node is a **one-shot**. It owns its process, so
it can end it. When the last step completes it:

1. Keeps streaming setpoints for a 5 s grace, so PX4 settles onto the
   final target while it's still being fed.
2. Hands PX4 back to `AUTO.LOITER` via `DO_SET_MODE` — the same
   discipline as a deactivate, so the stream is never dropped
   unguarded.
3. Publishes a final `{"state": "done", "detail": "mission complete;
   node exiting"}` and exits 0.

Aborting mid-flight takes the same exit: loiter, publish `aborted`,
end the process.

The program block is written with `autorestart = unexpected` and
`exitcodes = 0`, so supervisord reads that clean exit as *finished*
rather than *crashed*. A flown node parks at `EXITED` in `supervisorctl
status` instead of respawning into the same flight forever — and

```
supervisorctl start <name>
```

replays the mission on demand. A genuine crash is still an unexpected
exit, so it's still restarted.
