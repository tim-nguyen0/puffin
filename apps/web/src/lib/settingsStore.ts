import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Units = "metric" | "imperial";

interface SettingsState {
  units: Units;
  telemetryHistoryLimit: number;
  wsUrl: string;
  apiBaseUrl: string;
  setUnits: (units: Units) => void;
  setTelemetryHistoryLimit: (limit: number) => void;
  setWsUrl: (url: string) => void;
  setApiBaseUrl: (url: string) => void;
}

const WS_PROTOCOL = window.location.protocol === "https:" ? "wss:" : "ws:";
const DEFAULT_WS_URL = `${WS_PROTOCOL}//${window.location.host}/ws/telemetry`;
const DEFAULT_API_BASE_URL = "/api";

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      units: "metric",
      telemetryHistoryLimit: 600,
      wsUrl: DEFAULT_WS_URL,
      apiBaseUrl: DEFAULT_API_BASE_URL,
      setUnits: (units) => set({ units }),
      setTelemetryHistoryLimit: (limit) => set({ telemetryHistoryLimit: limit }),
      setWsUrl: (url) => set({ wsUrl: url }),
      setApiBaseUrl: (url) => set({ apiBaseUrl: url }),
    }),
    { name: "puffin-settings" },
  ),
);
