#!/usr/bin/env bash
# railway injects $PORT; default keeps local smoke tests simple. only
# ${PORT} is substituted - nginx's own $vars must survive envsubst.
set -e
: "${PORT:=8080}"
export PORT
mkdir -p /data
envsubst '${PORT}' < /etc/nginx/templates/puffin.conf.template > /etc/nginx/conf.d/puffin.conf
exec supervisord -n -c /etc/supervisor/supervisord.conf
