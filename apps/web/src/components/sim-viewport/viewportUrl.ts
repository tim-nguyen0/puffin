// pixels go over novnc; numbers go over the telemetry websocket. public
// demo build: streams are proxied on the same origin so one public
// hostname carries the whole app through the tunnel. the host args exist
// to match the private build's signature and are unused here.
export function simViewportUrl(_protocol: string, _hostname: string): string {
  return "/novnc/vnc.html?autoconnect=true&resize=scale&reconnect=true&path=novnc/websockify";
}

// qgroundcontrol rides the same recipe on its own proxied path; the panel
// shows its offline hint until a qgc stream exists behind it.
export function qgcViewportUrl(_protocol: string, _hostname: string): string {
  return "/qgc/vnc.html?autoconnect=true&resize=scale&reconnect=true&path=qgc/websockify";
}
