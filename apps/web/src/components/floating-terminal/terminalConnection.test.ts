import { describe, expect, it } from "vitest";
import {
  terminalInputMessage,
  terminalResizeMessage,
  terminalWebSocketUrl,
} from "./terminalConnection";

describe("terminal connection", () => {
  it("uses a secure websocket on an https page", () => {
    expect(terminalWebSocketUrl("https:", "puffin.test")).toBe(
      "wss://puffin.test/ws/terminal",
    );
  });

  it("uses a normal websocket during local development", () => {
    expect(terminalWebSocketUrl("http:", "localhost:5173")).toBe(
      "ws://localhost:5173/ws/terminal",
    );
  });

  it("creates input and resize messages", () => {
    expect(JSON.parse(terminalInputMessage("ls\r"))).toEqual({
      type: "input",
      data: "ls\r",
    });
    expect(JSON.parse(terminalResizeMessage(30, 100))).toEqual({
      type: "resize",
      rows: 30,
      cols: 100,
    });
  });
});
