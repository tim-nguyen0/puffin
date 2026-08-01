import asyncio
import codecs
from typing import Any

from fastapi import APIRouter, WebSocket

router = APIRouter()

MAX_INPUT_LENGTH = 65536
MIN_TERMINAL_SIZE = 2
MAX_TERMINAL_SIZE = 500


async def send_output(websocket: WebSocket, session: Any) -> None:
    decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
    while True:
        try:
            output = await session.read()
        except OSError:
            break
        if not output:
            final_output = decoder.decode(b"", final=True)
            if final_output:
                await websocket.send_text(final_output)
            break
        text = decoder.decode(output)
        if text:
            await websocket.send_text(text)


async def receive_input(websocket: WebSocket, session: Any) -> None:
    while True:
        message = await websocket.receive_json()
        if not isinstance(message, dict):
            continue

        message_type = message.get("type")
        if message_type == "input":
            data = message.get("data")
            if isinstance(data, str) and len(data) <= MAX_INPUT_LENGTH:
                await session.write(data)

        if message_type == "resize":
            rows = message.get("rows")
            cols = message.get("cols")
            if isinstance(rows, int) and isinstance(cols, int):
                rows = max(MIN_TERMINAL_SIZE, min(rows, MAX_TERMINAL_SIZE))
                cols = max(MIN_TERMINAL_SIZE, min(cols, MAX_TERMINAL_SIZE))
                session.resize(rows, cols)


@router.websocket("/ws/terminal")
async def terminal_stream(websocket: WebSocket) -> None:
    await websocket.accept()
    session = websocket.app.state.terminal_factory()

    try:
        session.start()
    except Exception:
        session.close()
        await websocket.send_text("Terminal session could not start.\r\n")
        await websocket.close(code=1011)
        return

    output_task = asyncio.create_task(send_output(websocket, session))
    input_task = asyncio.create_task(receive_input(websocket, session))

    try:
        done, pending = await asyncio.wait(
            {output_task, input_task},
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()
        await asyncio.gather(*done, *pending, return_exceptions=True)
    except asyncio.CancelledError:
        pass
    finally:
        output_task.cancel()
        input_task.cancel()
        session.close()
