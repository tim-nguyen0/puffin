import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useAuthStore } from "../../lib/authStore";
import { useSettingsStore } from "../../lib/settingsStore";
import "./floating-terminal.css";
import {
  terminalInputMessage,
  terminalResizeMessage,
  terminalWebSocketUrl,
} from "./terminalConnection";

export function FloatingTerminal() {
  const terminalElement = useRef<HTMLDivElement>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const dragStart = useRef({
    mouseX: 0,
    mouseY: 0,
    terminalX: 0,
    terminalY: 0,
  });
  // settings are loaded before the shell mounts, so the saved layout is
  // already in the store here
  const [position, setPosition] = useState(() => ({
    x: useSettingsStore.getState().terminalX,
    y: useSettingsStore.getState().terminalY,
  }));
  const [dragging, setDragging] = useState(false);
  const [minimized, setMinimized] = useState(
    () => useSettingsStore.getState().terminalMinimized,
  );
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");

  useEffect(() => {
    if (!terminalElement.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      // matches the console design's command palette (tokens cannot
      // reach xterm's canvas): --color-command-bg/-text/-accent
      theme: {
        background: "#0d1726",
        foreground: "#bdc9d8",
        cursor: "#20d49a",
      },
    });
    const terminalFitAddon = new FitAddon();
    let disposed = false;

    terminal.loadAddon(terminalFitAddon);
    terminal.open(terminalElement.current);
    terminalFitAddon.fit();
    fitAddon.current = terminalFitAddon;
    terminal.writeln("Connecting to Puffin terminal...");

    const socket = new WebSocket(
      terminalWebSocketUrl(window.location.protocol, window.location.host),
    );

    function sendResize() {
      if (socket.readyState !== WebSocket.OPEN) return;
      socket.send(terminalResizeMessage(terminal.rows, terminal.cols));
    }

    socket.onopen = () => {
      if (disposed) return;
      setConnectionStatus("connected");
      terminalFitAddon.fit();
      sendResize();
    };

    socket.onmessage = (event) => {
      if (typeof event.data === "string") terminal.write(event.data);
    };

    socket.onclose = () => {
      if (disposed) return;
      setConnectionStatus("disconnected");
      terminal.writeln("\r\nTerminal disconnected.");
    };

    const input = terminal.onData((data) => {
      if (socket.readyState !== WebSocket.OPEN) return;
      socket.send(terminalInputMessage(data));
    });
    const resize = terminal.onResize(sendResize);
    const fitToWindow = () => {
      if (terminalElement.current?.offsetParent) terminalFitAddon.fit();
    };
    window.addEventListener("resize", fitToWindow);

    return () => {
      disposed = true;
      window.removeEventListener("resize", fitToWindow);
      input.dispose();
      resize.dispose();
      socket.close();
      terminal.dispose();
      fitAddon.current = null;
    };
  }, []);

  useEffect(() => {
    if (minimized) return;
    const frame = requestAnimationFrame(() => fitAddon.current?.fit());
    return () => cancelAnimationFrame(frame);
  }, [minimized]);

  function startDragging(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = {
      mouseX: event.clientX,
      mouseY: event.clientY,
      terminalX: position.x,
      terminalY: position.y,
    };
    setDragging(true);
  }

  function moveTerminal(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;

    setPosition({
      x: dragStart.current.terminalX + event.clientX - dragStart.current.mouseX,
      y: dragStart.current.terminalY + event.clientY - dragStart.current.mouseY,
    });
  }

  function persistLayout(x: number, y: number, min: boolean) {
    const token = useAuthStore.getState().token;
    if (!token) return;
    useSettingsStore
      .getState()
      .saveTerminalLayout(token, { x, y, minimized: min })
      .catch(() => undefined);
  }

  function stopDragging(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;

    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
    persistLayout(position.x, position.y, minimized);
  }

  return (
    <section
      className={`floating-terminal${minimized ? " floating-terminal-minimized" : ""}`}
      aria-label="Terminal"
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
    >
      <div
        className="terminal-header"
        onPointerDown={startDragging}
        onPointerMove={moveTerminal}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
      >
        <div className="terminal-title">
          <span className="terminal-title-text">〉_ Terminal</span>
          <span
            className={`terminal-status terminal-status-${connectionStatus}`}
            role="status"
          >
            {connectionStatus === "connected" ? "● running" : `○ ${connectionStatus}`}
          </span>
        </div>
        <button
          className="terminal-minimize"
          type="button"
          onClick={() => {
            const next = !minimized;
            setMinimized(next);
            persistLayout(position.x, position.y, next);
          }}
          aria-label={minimized ? "Restore terminal" : "Minimize terminal"}
          aria-expanded={!minimized}
        >
          {minimized ? "+" : "−"}
        </button>
      </div>
      <div
        className={`terminal-body${minimized ? " terminal-body-hidden" : ""}`}
        ref={terminalElement}
      />
    </section>
  );
}
