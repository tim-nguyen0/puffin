import asyncio
import os
import signal
import struct
import time


class PtySession:
    def __init__(self) -> None:
        self.pid: int | None = None
        self.fd: int | None = None

    def start(self) -> None:
        import pty

        pid, fd = pty.fork()
        if pid == 0:
            environment = os.environ.copy()
            environment["TERM"] = "xterm-256color"
            environment["PS1"] = "puffin:\\w\\$ "
            if os.path.isdir("/app"):
                os.chdir("/app")
            shell = "/bin/bash"
            try:
                os.execvpe(shell, [shell, "--noprofile", "--norc", "-i"], environment)
            except OSError as exc:
                os.write(2, f"terminal could not start: {exc}\r\n".encode())
                os._exit(127)

        self.pid = pid
        self.fd = fd

    async def read(self) -> bytes:
        if self.fd is None:
            return b""
        return await asyncio.to_thread(os.read, self.fd, 4096)

    async def write(self, data: str) -> None:
        if self.fd is not None:
            await asyncio.to_thread(self._write_all, data.encode())

    def _write_all(self, data: bytes) -> None:
        if self.fd is None:
            return
        remaining = memoryview(data)
        while remaining:
            written = os.write(self.fd, remaining)
            remaining = remaining[written:]

    def resize(self, rows: int, cols: int) -> None:
        import fcntl
        import termios

        if self.fd is not None:
            size = struct.pack("HHHH", rows, cols, 0, 0)
            fcntl.ioctl(self.fd, termios.TIOCSWINSZ, size)

    def close(self) -> None:
        if self.fd is not None:
            try:
                os.close(self.fd)
            except OSError:
                pass
            self.fd = None

        if self.pid is not None:
            pid = self.pid
            try:
                os.killpg(pid, signal.SIGHUP)
            except OSError:
                pass
            deadline = time.monotonic() + 0.5
            while True:
                try:
                    finished, _ = os.waitpid(pid, os.WNOHANG)
                except ChildProcessError:
                    break
                if finished == pid:
                    break
                if time.monotonic() >= deadline:
                    try:
                        os.killpg(pid, signal.SIGKILL)
                    except OSError:
                        pass
                    try:
                        os.waitpid(pid, 0)
                    except ChildProcessError:
                        pass
                    break
                time.sleep(0.01)
            self.pid = None
