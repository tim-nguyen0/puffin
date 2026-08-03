// pixels go over novnc; numbers go over the telemetry websocket. this
// component only ever embeds the novnc pages - never a custom pixel path.
// two streams: the chrome-free scene for the dashboard and the full
// gazebo ui for the simulation pages.
export type ViewportVariant = "clean" | "full";

const PORTS: Record<ViewportVariant, string> = { clean: "6081", full: "6080" };

export function simViewportUrl(
  protocol: string,
  hostname: string,
  variant: ViewportVariant = "full",
): string {
  const params = "autoconnect=true&resize=scale&reconnect=true";
  return `${protocol}//${hostname}:${PORTS[variant]}/vnc.html?${params}`;
}
