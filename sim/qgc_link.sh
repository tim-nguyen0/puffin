#!/usr/bin/env bash
# two extra mavlink streams, both aimed at udp 14550, where qgroundcontrol
# listens by default: one to the docker host for a desktop qgc, one on
# loopback for the qgc running on display :2 in this container. px4's own
# gcs link stays untouched.
set -e
cd /px4/build/px4_sitl_default

# wait for the px4 daemon
until bin/px4-param show SYS_AUTOSTART >/dev/null 2>&1; do sleep 3; done

# in-container qgc: loopback is shared with the api and web containers
# (they join this network namespace), so no address discovery is needed
if bin/px4-mavlink start -u 14553 -t 127.0.0.1 -o 14550 -r 2000000; then
  echo "qgc link up: streaming to 127.0.0.1:14550 (in-container qgc)"
else
  echo "in-container qgc link skipped (mavlink refused)"
fi

# docker desktop publishes the host under this alias; plain docker
# exposes it via host-gateway. no host, no link - that's fine.
# px4's mavlink -t is ipv4-only; the alias resolves ipv6-first here
HOST_IP=$(getent ahostsv4 host.docker.internal | awk '{print $1; exit}')
if [ -n "$HOST_IP" ] && bin/px4-mavlink start -u 14552 -t "$HOST_IP" -o 14550 -r 2000000; then
  echo "qgc link up: streaming to $HOST_IP:14550"
else
  echo "qgc link skipped (no ipv4 host alias or mavlink refused)"
fi

# park so supervisorctl status stays all-RUNNING (make procs contract)
exec sleep infinity
