# Sim image: Gazebo Harmonic + PX4 SITL (standalone) + Micro XRCE-DDS agent +
# offboard_demo, all under supervisord. Layer order is slowest-changing first
# so world/demo edits don't rebuild PX4 (~40-70 min cold).
FROM ros:jazzy

ARG PX4_REF
ARG PX4_MSGS_REF

# Gazebo Harmonic (osrf repo) + X/VNC stack + toolchain
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl gnupg lsb-release ca-certificates \
    && curl -sSL https://packages.osrfoundation.org/gazebo.gpg \
      -o /usr/share/keyrings/pkgs-osrf-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/pkgs-osrf-archive-keyring.gpg] http://packages.osrfoundation.org/gazebo/ubuntu-stable $(lsb_release -cs) main" \
      > /etc/apt/sources.list.d/gazebo-stable.list \
    && apt-get update && apt-get install -y --no-install-recommends \
      gz-harmonic \
      supervisor xvfb x11vnc novnc websockify \
      git build-essential cmake ninja-build pkg-config \
      python3-pip python3-colcon-common-extensions \
      libasio-dev libtinyxml2-dev cppzmq-dev libzmq3-dev \
    && rm -rf /var/lib/apt/lists/*

# Micro XRCE-DDS agent (PX4 uORB <-> DDS bridge)
RUN git clone --branch v2.4.3 --depth 1 \
      https://github.com/eProsima/Micro-XRCE-DDS-Agent.git /tmp/xrce \
    && cmake -S /tmp/xrce -B /tmp/xrce/build -DCMAKE_BUILD_TYPE=Release \
    && cmake --build /tmp/xrce/build -j"$(nproc)" \
    && cmake --install /tmp/xrce/build \
    && ldconfig \
    && rm -rf /tmp/xrce

# PX4 SITL at PX4_REF — binary only. supervisord launches it standalone
# (PX4_GZ_STANDALONE=1); never `make px4_sitl gz_x500`, which forks a second
# Gazebo.
RUN git clone --branch "${PX4_REF}" --depth 1 --recurse-submodules --shallow-submodules \
      https://github.com/PX4/PX4-Autopilot.git /px4 \
    && pip3 install --break-system-packages -r /px4/Tools/setup/requirements.txt \
    && cd /px4 && DONT_RUN=1 make px4_sitl_default

# px4_msgs at PX4_MSGS_REF (same PX4 release as PX4_REF — gotcha #2). The
# offboard_demo package will be COPY'd into /ros_ws/src here once it exists.
RUN git clone --branch "${PX4_MSGS_REF}" --depth 1 \
      https://github.com/PX4/px4_msgs.git /ros_ws/src/px4_msgs \
    && bash -c "source /opt/ros/jazzy/setup.bash && cd /ros_ws && colcon build --symlink-install"

COPY supervisord.conf /etc/supervisor/conf.d/puffin.conf
COPY worlds/ /worlds/

# PX4's gz bridge must attach to the already-running puffin world; resource
# path lets it spawn the x500 model from the PX4 tree.
ENV PX4_GZ_WORLD=puffin \
    GZ_SIM_RESOURCE_PATH=/px4/Tools/simulation/gz/models:/px4/Tools/simulation/gz/worlds:/worlds

EXPOSE 6080 8000 5173

CMD ["supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
