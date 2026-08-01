// pixels go over novnc on :6080; numbers go over the telemetry websocket.
// this component only ever embeds the novnc page - never a custom pixel path.
const NOVNC_PORT = "6080";

export function simViewportUrl(protocol: string, hostname: string): string {
  const params = "autoconnect=true&resize=scale&reconnect=true";
  return `${protocol}//${hostname}:${NOVNC_PORT}/vnc.html?${params}`;
}
