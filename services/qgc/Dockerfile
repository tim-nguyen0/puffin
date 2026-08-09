# QGroundControl sidecar. Always linux/amd64 (compose pins it): QGC ships no
# arm64 appimage, and on apple silicon Rosetta emulates just this container
# while the sim stays native. It joins the sim's network namespace, hears the
# loopback mavlink stream qgc-link opens, and serves its own noVNC on 6081.
FROM ubuntu:24.04

# appimages need FUSE, which containers don't have - and the appimage's own
# runtime is a STATIC x86 binary rosetta refuses to execute, so it is never
# run at all: readelf finds where the elf ends and unsquashfs carves the
# payload out directly. everything inside squashfs-root is dynamically
# linked and runs fine under rosetta. the second apt block is QGC's qt6
# runtime (xcb platform plugin, sound, joystick, video widget).
RUN apt-get update && apt-get install -y --no-install-recommends \
      supervisor xvfb x11vnc novnc websockify curl ca-certificates \
      binutils squashfs-tools \
      libxcb-cursor0 libxcb-icccm4 libxcb-image0 libxcb-keysyms1 \
      libxcb-randr0 libxcb-render-util0 libxcb-shape0 libxcb-xinerama0 \
      libxcb-xkb1 libxkbcommon-x11-0 libpulse0 libsdl2-2.0-0 libspeechd2 \
      libgstreamer1.0-0 libgstreamer-plugins-base1.0-0 libgl1 libegl1 \
      fontconfig \
    && curl -fsSL -o /tmp/qgc.AppImage \
      https://github.com/mavlink/qgroundcontrol/releases/download/v5.1.0/QGroundControl-x86_64.AppImage \
    && offset=$(readelf -h /tmp/qgc.AppImage | awk \
        '/Start of section headers/{o=$5} /Size of section headers/{s=$5} \
         /Number of section headers/{n=$5} END{print o+s*n}') \
    && mkdir -p /opt/qgc \
    && unsquashfs -o "$offset" -d /opt/qgc/squashfs-root /tmp/qgc.AppImage \
    && rm /tmp/qgc.AppImage \
    && rm -rf /var/lib/apt/lists/*

COPY supervisord.conf /etc/supervisor/conf.d/qgc.conf

CMD ["/usr/bin/supervisord", "-n"]
