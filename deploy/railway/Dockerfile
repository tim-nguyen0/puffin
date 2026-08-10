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

# qgroundcontrol: railway is amd64, so the appimage runs natively here (no
# sidecar needed - one container anyway). same unsquashfs carve as
# services/qgc: the appimage's static runtime is never executed. runs as
# the ubuntu user via supervisord - qgc refuses root.
RUN apt-get update && apt-get install -y --no-install-recommends \
      binutils squashfs-tools \
      libxcb-cursor0 libxcb-icccm4 libxcb-image0 libxcb-keysyms1 \
      libxcb-randr0 libxcb-render-util0 libxcb-shape0 libxcb-xinerama0 \
      libxcb-xkb1 libxkbcommon-x11-0 libpulse0 libsdl2-2.0-0 libspeechd2 \
      libgstreamer1.0-0 libgstreamer-plugins-base1.0-0 \
    && curl -fsSL -o /tmp/qgc.AppImage \
      https://github.com/mavlink/qgroundcontrol/releases/download/v5.1.0/QGroundControl-x86_64.AppImage \
    && offset=$(readelf -h /tmp/qgc.AppImage | awk \
        '/Start of section headers/{o=$5} /Size of section headers/{s=$5} \
         /Number of section headers/{n=$5} END{print o+s*n}') \
    && mkdir -p /opt/qgc \
    && unsquashfs -o "$offset" -d /opt/qgc/squashfs-root /tmp/qgc.AppImage \
    && rm /tmp/qgc.AppImage \
    && rm -rf /var/lib/apt/lists/* \
    && id ubuntu >/dev/null 2>&1 || useradd -m ubuntu

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
