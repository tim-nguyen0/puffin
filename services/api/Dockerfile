# Built FROM the ROS image so rclpy is native — no IPC bridge (CLAUDE.md).
FROM ros:jazzy-ros-base

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml ./
COPY puffin_api/ puffin_api/
RUN pip install --break-system-packages .

CMD ["bash", "-lc", "source /opt/ros/jazzy/setup.bash && uvicorn puffin_api.main:app --host 0.0.0.0 --port 8000"]
