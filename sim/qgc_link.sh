#!/usr/bin/env bash
# streams mavlink to the docker host so a local qgroundcontrol
# auto-connects on udp 14550. px4's own gcs link stays inside the
# container; this adds one more instance aimed at the host gateway.
set -e
cd /px4/build/px4_sitl_default

# wait for the px4 daemon
until bin/px4-param show SYS_AUTOSTART >/dev/null 2>&1; do sleep 3; done

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
