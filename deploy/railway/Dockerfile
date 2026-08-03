# all-in-one image for railway. railway services cannot share a network
# namespace, so the three compose services collapse into one container:
# the sim image's process tree plus uvicorn and nginx, everything on
# loopback exactly like the compose netns trick provided.
#
# build from repo root:
#   docker build -f deploy/railway/Dockerfile --build-arg SIM_BASE=<sim image> .
ARG SIM_BASE=puffin-sim

FROM node:22-slim AS webbuild
RUN npm install -g pnpm
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ packages/
COPY apps/web/ apps/web/
RUN pnpm install --frozen-lockfile && pnpm --filter @puffin/web build

FROM ${SIM_BASE}

# api runtime on top of the sim image: gz python bindings for the gz
# adapter, nginx as the single public listener, envsubst for $PORT
RUN apt-get update && apt-get install -y --no-install-recommends \
      nginx gettext-base python3-gz-transport13 python3-gz-msgs10 \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default

COPY services/api/pyproject.toml /app/pyproject.toml
COPY services/api/puffin_api/ /app/puffin_api/
# ignore-installed: apt-managed python packages (typing_extensions) have
# no RECORD file and pip cannot uninstall them
RUN pip install --break-system-packages --ignore-installed /app

COPY --from=webbuild /repo/apps/web/dist /var/www/puffin
COPY deploy/railway/nginx.conf.template /etc/nginx/templates/puffin.conf.template
COPY deploy/railway/supervisord-railway.conf /etc/supervisor/conf.d/railway.conf
COPY deploy/railway/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# accounts live on the railway volume mounted at /data
ENV PUFFIN_DB_PATH=/data/puffin.db

CMD ["/entrypoint.sh"]
