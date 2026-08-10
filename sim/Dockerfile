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
# The fake nuttx-0.0.0 tags: shallow submodules carry no tags, but PX4's
# version-header script (px_update_git_header.py --validate) requires a
# nuttx-x.y.z tag even for SITL, which never runs NuttX. Tagging HEAD is
# cheaper than unshallowing the clone for a cosmetic version string.
# The dds_topics.yaml edit: uxrce_dds_client bridges only the topics listed
# there and vehicle_land_detected is not one of them upstream, so the api's
# subscription would match nothing and report a flying vehicle as landed
# forever (gotcha #1's failure mode, one layer down). The grep fails the
# build if a PX4_REF bump ever moves the anchor.
RUN git clone --branch "${PX4_REF}" --depth 1 --recurse-submodules --shallow-submodules \
      https://github.com/PX4/PX4-Autopilot.git /px4 \
    && for sub in platforms/nuttx/NuttX/nuttx platforms/nuttx/NuttX/apps; do \
         if [ -d "/px4/${sub}" ]; then git -C "/px4/${sub}" tag nuttx-0.0.0; fi; \
       done \
    && pip3 install --break-system-packages -r /px4/Tools/setup/requirements.txt \
    && sed -i '0,/^publications:/s||publications:\n\n  - topic: /fmu/out/vehicle_land_detected\n    type: px4_msgs::msg::VehicleLandDetected|' \
         /px4/src/modules/uxrce_dds_client/dds_topics.yaml \
    && grep -q "vehicle_land_detected" /px4/src/modules/uxrce_dds_client/dds_topics.yaml \
    && cd /px4 && DONT_RUN=1 make px4_sitl_default

# px4_msgs at PX4_MSGS_REF (same PX4 release as PX4_REF — gotcha #2).
RUN git clone --branch "${PX4_MSGS_REF}" --depth 1 \
      https://github.com/PX4/px4_msgs.git /ros_ws/src/px4_msgs \
    && bash -c "source /opt/ros/jazzy/setup.bash && cd /ros_ws && colcon build --symlink-install"

# user packages last: anything with a package.xml dropped into
# sim/packages/ builds here, and edits rebuild only this layer, never
# px4_msgs (which is skipped - its install from the layer above stands)
COPY packages/ /ros_ws/src/
RUN bash -c "source /opt/ros/jazzy/setup.bash && cd /ros_ws \
      && colcon build --symlink-install --packages-skip px4_msgs"

# supervisord's drop-in dir: the forge writes program blocks here at runtime,
# and a forged package that was persisted back into sim/packages/ brings its
# block along as forge.conf, so baking it into the image also restores it.
RUN mkdir -p /etc/supervisor/conf.d \
    && for f in /ros_ws/src/*/forge.conf; do \
         [ -e "$f" ] || continue; \
         cp "$f" "/etc/supervisor/conf.d/$(basename "$(dirname "$f")").conf"; \
       done

COPY supervisord.conf /etc/supervisor/conf.d/puffin.conf
COPY qgc_link.sh /qgc_link.sh
COPY worlds/ /worlds/

# full gz gui, pinned to the 1280x720 screen: take gazebo's default gui
# config and size its window so the stream has no dead space
RUN cfg=$(find /usr/share/gz -maxdepth 3 -name gui.config | head -1) \
    && cp "$cfg" /gui_full.config \
    && sed -i 's|<width>[0-9]*</width>|<width>1280</width>|; s|<height>[0-9]*</height>|<height>720</height>|' /gui_full.config

# PX4's gz bridge must attach to the already-running puffin world; resource
# path lets it spawn the x500 model from the PX4 tree.
ENV PX4_GZ_WORLD=puffin \
    GZ_SIM_RESOURCE_PATH=/px4/Tools/simulation/gz/models:/px4/Tools/simulation/gz/worlds:/worlds

EXPOSE 6080 6081 8000 5173

CMD ["supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
