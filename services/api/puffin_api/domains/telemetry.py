import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

STREAM_INTERVAL_S = 0.1


@router.websocket("/ws/telemetry")
async def telemetry_stream(websocket: WebSocket) -> None:
    await websocket.accept()
    ros = websocket.app.state.ros
    try:
        while True:
            result = ros.latest_telemetry()
            if result.ok:
                await websocket.send_json(result.data)
            await asyncio.sleep(STREAM_INTERVAL_S)
    except WebSocketDisconnect:
        pass
