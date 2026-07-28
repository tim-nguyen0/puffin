# Framework stub — the real image adds Gazebo Harmonic, PX4 SITL (built at
# PX4_REF with PX4_GZ_STANDALONE=1), Micro XRCE-DDS agent, px4_msgs at
# PX4_MSGS_REF, and the noVNC/Xvfb stack. Program layout is already fixed in
# supervisord.conf; fill in the install steps without changing it.
FROM ros:jazzy

ARG PX4_REF
ARG PX4_MSGS_REF

RUN apt-get update && apt-get install -y --no-install-recommends \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

COPY supervisord.conf /etc/supervisor/conf.d/puffin.conf
COPY worlds/ /worlds/

EXPOSE 6080 8000 5173

CMD ["supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
