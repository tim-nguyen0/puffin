export function terminalWebSocketUrl(protocol: string, host: string): string {
  const websocketProtocol = protocol === "https:" ? "wss:" : "ws:";
  return `${websocketProtocol}//${host}/ws/terminal`;
}

export function terminalInputMessage(data: string): string {
  return JSON.stringify({ type: "input", data });
}

export function terminalResizeMessage(rows: number, cols: number): string {
  return JSON.stringify({ type: "resize", rows, cols });
}
