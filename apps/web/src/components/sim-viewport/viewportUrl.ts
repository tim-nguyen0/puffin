// pixels go over novnc; numbers go over the telemetry websocket. public
// demo build: both streams are proxied on the same origin so one public
// hostname carries the whole app through the tunnel.
export type ViewportVariant = "clean" | "full";

const PATHS: Record<ViewportVariant, string> = { clean: "novnc-clean", full: "novnc" };

export function simViewportUrl(variant: ViewportVariant = "full"): string {
  const base = PATHS[variant];
  return `/${base}/vnc.html?autoconnect=true&resize=scale&reconnect=true&path=${base}/websockify`;
}
