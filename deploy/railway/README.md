# Puffin on Railway

One service, one image: sim + api + web under supervisord, nginx on
`$PORT`. Built by the `railway image` GitHub workflow and pushed to
ghcr; Railway deploys from the registry (its builder would time out on
the px4 compile).

## One-time setup

1. **Build the image**: push this branch (or run the `railway image`
   workflow from the Actions tab). First run ~1 h; cached runs are
   minutes. Result: `ghcr.io/tim-nguyen0/puffin-railway:latest`.
2. **Make the package pullable**: on github.com → your profile →
   Packages → `puffin-railway` → Package settings → either change
   visibility to Public (simplest) or keep it private and create a
   classic PAT with `read:packages` for Railway to use.
3. **Railway** (railway.app):
   - New Project → **Deploy a Docker image** →
     `ghcr.io/tim-nguyen0/puffin-railway:latest` (add the PAT as
     registry credentials if the package is private).
   - Service → **Volumes** → add a volume mounted at `/data`
     (accounts/settings live there and survive redeploys).
   - Service → Settings → **Networking** → Generate Domain. Railway
     injects `$PORT`; nginx binds it automatically.
   - Service → Settings → **Resources**: give it everything the plan
     allows (8 vCPU / 8 GB). Gazebo with software rendering is hungry;
     less than ~6 vCPU will stutter.
4. Open the generated `*.up.railway.app` URL: sign up, fly.

## Demo-day pattern

Cloud CPU is weaker per-core than a dev laptop - expect a softer
viewport framerate than local. To keep cost near zero between demos,
remove the service (the volume keeps the accounts) and redeploy from
the image an hour before showtime; it pulls and boots in minutes.

## Updating

Merge changes into this branch (or rebase it onto main) and push - the
workflow rebuilds and pushes `:latest`; then redeploy the service in
Railway.
