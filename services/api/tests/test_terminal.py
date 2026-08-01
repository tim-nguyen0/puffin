import asyncio
import os

import pytest
from fastapi.testclient import TestClient

from puffin_api.adapters.terminal import PtySession


class FakeTerminal:
    instances: list["FakeTerminal"] = []

    def __init__(self) -> None:
        self.output: asyncio.Queue[bytes] = asyncio.Queue()
        self.writes: list[str] = []
        self.sizes: list[tuple[int, int]] = []
        self.closed = False
        self.instances.append(self)

    def start(self) -> None:
        self.output.put_nowait(b"ready")

    async def read(self) -> bytes:
        return await self.output.get()

    async def write(self, data: str) -> None:
        self.writes.append(data)
        self.output.put_nowait(b"received")

    def resize(self, rows: int, cols: int) -> None:
        self.sizes.append((rows, cols))

    def close(self) -> None:
        self.closed = True


def test_terminal_moves_input_output_and_size(client: TestClient) -> None:
    FakeTerminal.instances.clear()
    client.app.state.terminal_factory = FakeTerminal

    with client.websocket_connect("/ws/terminal") as websocket:
        assert websocket.receive_text() == "ready"
        websocket.send_json({"type": "resize", "rows": 30, "cols": 100})
        websocket.send_json({"type": "input", "data": "echo hello\r"})
        assert websocket.receive_text() == "received"

    terminal = FakeTerminal.instances[0]
    assert terminal.writes == ["echo hello\r"]
    assert terminal.sizes == [(30, 100)]
    assert terminal.closed is True


def test_terminal_clamps_size(client: TestClient) -> None:
    FakeTerminal.instances.clear()
    client.app.state.terminal_factory = FakeTerminal

    with client.websocket_connect("/ws/terminal") as websocket:
        assert websocket.receive_text() == "ready"
        websocket.send_json({"type": "resize", "rows": 1, "cols": 800})
        websocket.send_json({"type": "input", "data": "\r"})
        assert websocket.receive_text() == "received"

    assert FakeTerminal.instances[0].sizes == [(2, 500)]


def test_terminal_ignores_oversized_input(client: TestClient) -> None:
    FakeTerminal.instances.clear()
    client.app.state.terminal_factory = FakeTerminal

    with client.websocket_connect("/ws/terminal") as websocket:
        assert websocket.receive_text() == "ready"
        websocket.send_json({"type": "input", "data": "x" * 65537})
        websocket.send_json({"type": "input", "data": "ok"})
        assert websocket.receive_text() == "received"

    assert FakeTerminal.instances[0].writes == ["ok"]


@pytest.mark.skipif(os.name != "posix", reason="PTYs require a POSIX system")
def test_pty_session_runs_a_shell_command() -> None:
    async def run_command() -> str:
        session = PtySession()
        session.start()
        output = ""
        try:
            session.resize(30, 100)
            await session.write('printf "__PUFFIN_TERMINAL_OK__\\n"\r')
            while "__PUFFIN_TERMINAL_OK__" not in output:
                chunk = await asyncio.wait_for(session.read(), timeout=3)
                output += chunk.decode(errors="replace")
        finally:
            session.close()
        return output

    assert "__PUFFIN_TERMINAL_OK__" in asyncio.run(run_command())
