import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef } from "react";
import "./floating-terminal.css";

export function FloatingTerminal() {
  const terminalElement = useRef<HTMLDivElement>(null);

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

  return (
    <section className="floating-terminal" aria-label="Terminal">
      <div className="terminal-header">
        <span className="terminal-status" />
        <span>Terminal</span>
      </div>
      <div className="terminal-body" ref={terminalElement} />
    </section>
  );
}
