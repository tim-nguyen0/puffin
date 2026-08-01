from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


@router.websocket("/ws/teleop")
async def teleop_stream(websocket: WebSocket) -> None:
    # frames are {vx, vy, vz, yaw_rate} in ned m/s; the sim-side node
    # clamps and deadman-hovers, so this stays a dumb pipe
    await websocket.accept()
    ros = websocket.app.state.ros
    try:
        while True:
            frame = await websocket.receive_json()
            ros.publish_teleop(
                vx=float(frame.get("vx", 0.0)),
                vy=float(frame.get("vy", 0.0)),
                vz=float(frame.get("vz", 0.0)),
                yaw_rate=float(frame.get("yaw_rate", 0.0)),
            )
    except WebSocketDisconnect:
        pass
