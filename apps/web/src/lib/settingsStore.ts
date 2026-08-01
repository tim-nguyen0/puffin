import type { components } from "@puffin/api-types";
import { create } from "zustand";

type ApiSettings = components["schemas"]["UserSettings"];
export type Units = ApiSettings["units"];

interface SettingsState {
  units: Units;
  telemetryHistoryLimit: number;
  wsUrl: string;
  apiBaseUrl: string;
  terminalX: number;
  terminalY: number;
  terminalMinimized: boolean;
  loading: boolean;
  error: string | null;
  load: (token: string) => Promise<void>;
  save: (token: string, settings: ApiSettings) => Promise<void>;
  saveTerminalLayout: (
    token: string,
    layout: { x: number; y: number; minimized: boolean },
  ) => Promise<void>;
  reset: () => void;
}

const WS_PROTOCOL = window.location.protocol === "https:" ? "wss:" : "ws:";
const DEFAULT_WS_URL = `${WS_PROTOCOL}//${window.location.host}/ws/telemetry`;
const DEFAULT_API_BASE_URL = "/api";

const defaults = {
  units: "metric" as const,
  telemetryHistoryLimit: 600,
  wsUrl: DEFAULT_WS_URL,
  apiBaseUrl: DEFAULT_API_BASE_URL,
  terminalX: 0,
  terminalY: 0,
  terminalMinimized: false,
};

function fromApi(settings: ApiSettings) {
  const wsUrl = settings.ws_url.startsWith("/")
    ? `${WS_PROTOCOL}//${window.location.host}${settings.ws_url}`
    : settings.ws_url;
  return {
    units: settings.units,
    telemetryHistoryLimit: settings.telemetry_history_limit,
    wsUrl,
    apiBaseUrl: settings.api_base_url,
    terminalX: settings.terminal_x,
    terminalY: settings.terminal_y,
    terminalMinimized: settings.terminal_minimized,
  };
}

async function responseError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null) as { detail?: unknown } | null;
  return typeof body?.detail === "string" ? body.detail : fallback;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...defaults,
  loading: false,
  error: null,
  load: async (token) => {
    set({ loading: true, error: null });
    const response = await fetch(`${get().apiBaseUrl}/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      set({
        loading: false,
        error: await responseError(response, "Could not load settings"),
      });
      return;
    }
    const settings = await response.json() as ApiSettings;
    set({ ...fromApi(settings), loading: false, error: null });
  },
  save: async (token, settings) => {
    set({ loading: true, error: null });
    const response = await fetch(`${get().apiBaseUrl}/settings`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(settings),
    });
    if (!response.ok) {
      const message = await responseError(response, "Could not save settings");
      set({ loading: false, error: message });
      throw new Error(message);
    }
    const saved = await response.json() as ApiSettings;
    set({ ...fromApi(saved), loading: false, error: null });
  },
  saveTerminalLayout: async (token, layout) => {
    const state = get();
    await state.save(token, {
      units: state.units,
      telemetry_history_limit: state.telemetryHistoryLimit,
      ws_url: state.wsUrl,
      api_base_url: state.apiBaseUrl,
      terminal_x: layout.x,
      terminal_y: layout.y,
      terminal_minimized: layout.minimized,
    });
  },
  reset: () => set({ ...defaults, loading: false, error: null }),
}));
