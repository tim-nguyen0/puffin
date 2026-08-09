// pixels go over novnc; numbers go over the telemetry websocket. one
// stream remains: the full gazebo ui for the simulation and console
// pages - the dashboard renders its scene client-side from telemetry.
export function simViewportUrl(protocol: string, hostname: string): string {
  const params = "autoconnect=true&resize=scale&reconnect=true";
  return `${protocol}//${hostname}:6080/vnc.html?${params}`;
}

// qgroundcontrol streams over its own novnc port, same host, same recipe.
export function qgcViewportUrl(protocol: string, hostname: string): string {
  const params = "autoconnect=true&resize=scale&reconnect=true";
  return `${protocol}//${hostname}:6081/vnc.html?${params}`;
}
