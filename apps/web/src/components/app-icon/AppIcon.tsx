type AppIconName =
  | "camera"
  | "drone"
  | "globe"
  | "map-pin"
  | "network"
  | "pipeline"
  | "radar"
  | "search"
  | "sensors"
  | "vehicle";

interface AppIconProps {
  name: AppIconName;
}

const paths: Record<AppIconName, ReactNode> = {
  camera: (
    <>
      <rect x="2.5" y="4.5" width="8.5" height="7" rx="1.3" />
      <path d="m11 7 3-1.8v5.6L11 9" />
    </>
  ),
  drone: (
    <>
      <path d="M8 6v4M6 8h4M4.5 4.5l2 2M11.5 4.5l-2 2M4.5 11.5l2-2M11.5 11.5l-2-2" />
      <circle cx="3.5" cy="3.5" r="2" />
      <circle cx="12.5" cy="3.5" r="2" />
      <circle cx="3.5" cy="12.5" r="2" />
      <circle cx="12.5" cy="12.5" r="2" />
    </>
  ),
  globe: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M2.8 8h10.4M8 2.5c2.3 2.5 2.3 8.5 0 11M8 2.5c-2.3 2.5-2.3 8.5 0 11" />
    </>
  ),
  "map-pin": (
    <>
      <path d="M12.5 6.5c0 3.2-4.5 7-4.5 7s-4.5-3.8-4.5-7a4.5 4.5 0 1 1 9 0Z" />
      <circle cx="8" cy="6.5" r="1.5" />
    </>
  ),
  network: (
    <>
      <circle cx="8" cy="3" r="1.5" />
      <circle cx="4" cy="12.5" r="1.5" />
      <circle cx="12" cy="12.5" r="1.5" />
      <path d="M7.3 4.4 4.7 11M8.7 4.4l2.6 6.6M5.5 12.5h5" />
    </>
  ),
  pipeline: (
    <>
      <path d="M3 4.5h4v3H3zM9 8.5h4v3H9zM7 6h2v4M4 12.5h3M9 3.5h3" />
    </>
  ),
  radar: (
    <>
      <circle cx="8" cy="8" r="1.2" />
      <path d="M8 8l4-4M12.7 8a4.7 4.7 0 1 1-1.4-3.3M8 1.5a6.5 6.5 0 1 1-4.6 1.9" />
    </>
  ),
  search: (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.3 10.3 3.2 3.2" />
    </>
  ),
  sensors: (
    <>
      <circle cx="8" cy="8" r="1.5" />
      <path d="M5.2 10.8a4 4 0 0 1 0-5.6M10.8 5.2a4 4 0 0 1 0 5.6M3.1 12.9a7 7 0 0 1 0-9.8M12.9 3.1a7 7 0 0 1 0 9.8" />
    </>
  ),
  vehicle: (
    <>
      <circle cx="5" cy="4" r="2" />
      <circle cx="11" cy="4" r="2" />
      <circle cx="5" cy="12" r="2" />
      <circle cx="11" cy="12" r="2" />
      <path d="M5 6v4M11 6v4M5 8h6" />
    </>
  ),
};

export function AppIcon({ name }: AppIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
import type { ReactNode } from "react";
