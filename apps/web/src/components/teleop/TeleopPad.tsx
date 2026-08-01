import { useEffect, useRef, useState } from "react";
import {
  teleopFrame,
  teleopWebSocketUrl,
  type TeleopDirection,
} from "./teleopMessages";
import "./teleop-pad.css";

const STREAM_INTERVAL_MS = 100;

const PAD: { direction: TeleopDirection; label: string; area: string }[] = [
  { direction: "forward", label: "↑", area: "forward" },
  { direction: "left", label: "←", area: "left" },
  { direction: "back", label: "↓", area: "back" },
  { direction: "right", label: "→", area: "right" },
  { direction: "up", label: "Up", area: "up" },
  { direction: "down", label: "Down", area: "down" },
];

export function TeleopPad() {
  const socket = useRef<WebSocket | null>(null);
  const held = useRef<Set<TeleopDirection>>(new Set());
  const [connected, setConnected] = useState(false);
  const [active, setActive] = useState<TeleopDirection | null>(null);

  useEffect(() => {
    const ws = new WebSocket(teleopWebSocketUrl(window.location.protocol, window.location.host));
    socket.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    // stream while anything is held; the sim-side deadman covers stalls
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN && held.current.size > 0) {
        ws.send(JSON.stringify(teleopFrame(held.current)));
      }
    }, STREAM_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      ws.close();
      socket.current = null;
    };
  }, []);

  function send() {
    const ws = socket.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(teleopFrame(held.current)));
    }
  }

  function press(direction: TeleopDirection) {
    held.current.add(direction);
    setActive(direction);
    send();
  }

  function release(direction: TeleopDirection) {
    held.current.delete(direction);
    setActive(held.current.size > 0 ? [...held.current][0] : null);
    // an explicit hover frame beats waiting out the deadman
    send();
  }

  return (
    <div className="teleop-pad">
      <div className="teleop-grid">
        {PAD.map(({ direction, label, area }) => (
          <button
            key={direction}
            type="button"
            className={`teleop-button${active === direction ? " teleop-button-held" : ""}`}
            style={{ gridArea: area }}
            onPointerDown={() => press(direction)}
            onPointerUp={() => release(direction)}
            onPointerLeave={() => release(direction)}
            onPointerCancel={() => release(direction)}
            aria-label={`fly ${direction}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="teleop-hint">
        <span className={`teleop-dot ${connected ? "is-ok" : ""}`} />
        Hold to fly — needs <span className="teleop-mono">/teleop</span> active and the vehicle
        armed
      </p>
    </div>
  );
}
