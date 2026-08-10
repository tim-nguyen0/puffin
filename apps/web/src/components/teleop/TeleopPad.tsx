import { useEffect, useRef, useState } from "react";
import { frameIsActive, gamepadFrame } from "./gamepad";
import {
  teleopFrame,
  teleopWebSocketUrl,
  type TeleopDirection,
} from "./teleopMessages";
import "./teleop-pad.css";

const STREAM_INTERVAL_MS = 100;

// arrows read as up/down on screen but fly north/east - the hint says which
const PAD: { direction: TeleopDirection; label: string; area: string; hint: string }[] = [
  { direction: "forward", label: "↑", area: "forward", hint: "forward (north)" },
  { direction: "left", label: "←", area: "left", hint: "left (west)" },
  { direction: "back", label: "↓", area: "back", hint: "back (south)" },
  { direction: "right", label: "→", area: "right", hint: "right (east)" },
  { direction: "up", label: "Up", area: "up", hint: "climb" },
  { direction: "down", label: "Down", area: "down", hint: "descend" },
];

export function TeleopPad() {
  const socket = useRef<WebSocket | null>(null);
  const held = useRef<Set<TeleopDirection>>(new Set());
  // sticks stream while deflected; one hover frame on release so the
  // vehicle stops without waiting out the deadman
  const stickWasActive = useRef(false);
  const padEnabled = useRef(false);
  const [connected, setConnected] = useState(false);
  const [active, setActive] = useState<TeleopDirection | null>(null);
  const [gamepadId, setGamepadId] = useState<string | null>(null);
  const [gamepadOn, setGamepadOn] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(teleopWebSocketUrl(window.location.protocol, window.location.host));
    socket.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    // stream while sticks are deflected or buttons held; the sim-side
    // deadman covers stalls either way
    const interval = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const pad = padEnabled.current
        ? navigator.getGamepads?.()?.find((entry) => entry !== null)
        : null;
      if (pad) {
        const frame = gamepadFrame(pad.axes);
        if (frameIsActive(frame)) {
          stickWasActive.current = true;
          ws.send(JSON.stringify(frame));
          return;
        }
        if (stickWasActive.current) {
          stickWasActive.current = false;
          ws.send(JSON.stringify(frame));
          return;
        }
      }
      if (held.current.size > 0) {
        ws.send(JSON.stringify(teleopFrame(held.current)));
      }
    }, STREAM_INTERVAL_MS);
    const onConnect = (event: GamepadEvent) => setGamepadId(event.gamepad.id);
    const onDisconnect = () => {
      const remaining = navigator.getGamepads?.()?.find((entry) => entry !== null);
      setGamepadId(remaining?.id ?? null);
    };
    window.addEventListener("gamepadconnected", onConnect);
    window.addEventListener("gamepaddisconnected", onDisconnect);
    // a pad plugged in before mount only surfaces via polling
    const preConnected = navigator.getGamepads?.()?.find((entry) => entry !== null);
    if (preConnected) setGamepadId(preConnected.id);

    return () => {
      clearInterval(interval);
      window.removeEventListener("gamepadconnected", onConnect);
      window.removeEventListener("gamepaddisconnected", onDisconnect);
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
        {PAD.map(({ direction, label, area, hint }) => (
          <button
            key={direction}
            type="button"
            className={`teleop-button${active === direction ? " teleop-button-held" : ""}`}
            style={{ gridArea: area }}
            title={`hold to fly ${hint}`}
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
      <div className="teleop-gamepad">
        {gamepadId ? (
          <>
            <label className="teleop-gamepad-toggle">
              <input
                type="checkbox"
                checked={gamepadOn}
                onChange={(event) => {
                  padEnabled.current = event.target.checked;
                  setGamepadOn(event.target.checked);
                }}
              />
              Fly with controller
            </label>
            <span className="teleop-gamepad-id" title={gamepadId}>
              🎮 {gamepadId.slice(0, 40)}
            </span>
            {gamepadOn ? (
              <span className="teleop-gamepad-hint">
                left stick: climb / yaw · right stick: north / east
              </span>
            ) : null}
          </>
        ) : (
          <span className="teleop-gamepad-hint">
            🎮 plug in a controller and press any button to fly with sticks
          </span>
        )}
      </div>
    </div>
  );
}
