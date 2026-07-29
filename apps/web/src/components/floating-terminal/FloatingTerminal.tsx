import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import "./floating-terminal.css";

export function FloatingTerminal() {
  const terminalElement = useRef<HTMLDivElement>(null);
  const dragStart = useRef({
    mouseX: 0,
    mouseY: 0,
    terminalX: 0,
    terminalY: 0,
  });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    if (!terminalElement.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    });

    terminal.open(terminalElement.current);
    terminal.writeln("Puffin terminal");
    terminal.writeln("Backend connection is not hooked up yet.");
    terminal.write("$ ");

    return () => terminal.dispose();
  }, []);

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

  function stopDragging(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;

    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
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
          <span className="terminal-status" />
          <span>Terminal</span>
        </div>
        <button
          className="terminal-minimize"
          type="button"
          onClick={() => setMinimized(!minimized)}
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
