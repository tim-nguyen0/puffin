# built FROM the ROS image so rclpy is native — no IPC bridge (CLAUDE.md)
FROM ros:jazzy-ros-base

ARG PX4_MSGS_REF

# gz python bindings (osrf repo) for the gz adapter + toolchain for px4_msgs
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl gnupg lsb-release ca-certificates \
    && curl -sSL https://packages.osrfoundation.org/gazebo.gpg \
      -o /usr/share/keyrings/pkgs-osrf-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/pkgs-osrf-archive-keyring.gpg] http://packages.osrfoundation.org/gazebo/ubuntu-stable $(lsb_release -cs) main" \
      > /etc/apt/sources.list.d/gazebo-stable.list \
    && apt-get update && apt-get install -y --no-install-recommends \
      python3-pip git build-essential cmake python3-colcon-common-extensions \
      python3-gz-transport13 python3-gz-msgs10 \
    && rm -rf /var/lib/apt/lists/*

# px4_msgs at PX4_MSGS_REF — same PX4 release as PX4_REF, bump both or neither
RUN git clone --branch "${PX4_MSGS_REF}" --depth 1 \
      https://github.com/PX4/px4_msgs.git /ros_ws/src/px4_msgs \
    && bash -c "source /opt/ros/jazzy/setup.bash && cd /ros_ws && colcon build"

WORKDIR /app
COPY pyproject.toml ./
COPY puffin_api/ puffin_api/
RUN pip install --break-system-packages .

CMD ["bash", "-lc", "source /opt/ros/jazzy/setup.bash && source /ros_ws/install/setup.bash && uvicorn puffin_api.main:app --host 0.0.0.0 --port 8000"]
