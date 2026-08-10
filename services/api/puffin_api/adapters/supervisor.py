"""Wrapper around supervisord's XML-RPC interface. The only place that talks to supervisor."""

import xmlrpc.client

from . import AdapterResult

SIM_PROGRAMS = ("gz-server", "gz-gui", "xrce-agent", "px4")

_STATE_NAMES = {
    "STOPPED",
    "STARTING",
    "RUNNING",
    "BACKOFF",
    "STOPPING",
    "EXITED",
    "FATAL",
    "UNKNOWN",
}


class SupervisorAdapter:
    def __init__(self, url: str = "http://127.0.0.1:9001/RPC2") -> None:
        self._url = url

    def _proxy(self) -> xmlrpc.client.ServerProxy:
        return xmlrpc.client.ServerProxy(self._url)

    def list_processes(self) -> AdapterResult:
        try:
            infos = self._proxy().supervisor.getAllProcessInfo()
        except Exception as exc:  # noqa: BLE001 - clean {ok, detail} at the boundary
            return AdapterResult(ok=False, detail=f"supervisor unreachable: {exc}")
        procs = [
            {
                "name": info["name"],
                "state": info["statename"] if info["statename"] in _STATE_NAMES else "UNKNOWN",
                "uptime_s": max(0, int(info.get("now", 0)) - int(info.get("start", 0)))
                if info["statename"] == "RUNNING"
                else 0,
            }
            for info in infos
        ]
        return AdapterResult(ok=True, data=procs)

    def start_sim(self) -> AdapterResult:
        return self._batch("startProcess", "started")

    def stop_sim(self) -> AdapterResult:
        return self._batch("stopProcess", "stopped", reverse=True)

    def start_program(self, name: str) -> AdapterResult:
        return self._one("startProcess", name, "started")

    def stop_program(self, name: str) -> AdapterResult:
        return self._one("stopProcess", name, "stopped")

    def _one(self, method: str, name: str, verb: str) -> AdapterResult:
        # supervisor's start/stopProcess block until the program settles, which
        # is what makes a stop -> gz work -> start sequence safe to write inline
        try:
            getattr(self._proxy().supervisor, method)(name)
        except xmlrpc.client.Fault as exc:
            if "ALREADY_STARTED" not in exc.faultString and "NOT_RUNNING" not in exc.faultString:
                return AdapterResult(ok=False, detail=f"{name}: {exc.faultString}")
        except Exception as exc:  # noqa: BLE001
            return AdapterResult(ok=False, detail=f"supervisor unreachable: {exc}")
        return AdapterResult(ok=True, detail=f"{verb}: {name}")

    def _batch(self, method: str, verb: str, reverse: bool = False) -> AdapterResult:
        programs = tuple(reversed(SIM_PROGRAMS)) if reverse else SIM_PROGRAMS
        done: list[str] = []
        for name in programs:
            try:
                getattr(self._proxy().supervisor, method)(name)
                done.append(name)
            except xmlrpc.client.Fault as exc:
                if "ALREADY_STARTED" in exc.faultString or "NOT_RUNNING" in exc.faultString:
                    done.append(name)
                    continue
                return AdapterResult(ok=False, detail=f"{name}: {exc.faultString}")
            except Exception as exc:  # noqa: BLE001
                return AdapterResult(ok=False, detail=f"supervisor unreachable: {exc}")
        return AdapterResult(ok=True, detail=f"{verb}: {', '.join(done)}")
