import type { components } from "@puffin/api-types";
import { create } from "zustand";
import { api, apiErrorMessage, authHeaders } from "./api";

type ApiSettings = components["schemas"]["UserSettings"];
export type Units = ApiSettings["units"];

interface SettingsState {
  units: Units;
  telemetryHistoryLimit: number;
  wsUrl: string;
  apiBaseUrl: string;
  loading: boolean;
  error: string | null;
  load: (token: string) => Promise<void>;
  save: (token: string, settings: ApiSettings) => Promise<void>;
  reset: () => void;
}

const defaults = {
  units: "metric" as const,
  telemetryHistoryLimit: 600,
  wsUrl: "/ws/telemetry",
  apiBaseUrl: "/api",
};

function fromApi(settings: ApiSettings) {
  return {
    units: settings.units,
    telemetryHistoryLimit: settings.telemetry_history_limit,
    wsUrl: settings.ws_url,
    apiBaseUrl: settings.api_base_url,
  };
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...defaults,
  loading: false,
  error: null,
  load: async (token) => {
    set({ loading: true, error: null });
    const { data, error } = await api.GET("/settings", {
      headers: authHeaders(token),
    });
    if (error || !data) {
      set({ loading: false, error: apiErrorMessage(error, "Could not load settings") });
      return;
    }
    set({ ...fromApi(data), loading: false, error: null });
  },
  save: async (token, settings) => {
    set({ loading: true, error: null });
    const { data, error } = await api.PUT("/settings", {
      headers: authHeaders(token),
      body: settings,
    });
    if (error || !data) {
      const message = apiErrorMessage(error, "Could not save settings");
      set({ loading: false, error: message });
      throw new Error(message);
    }
    set({ ...fromApi(data), loading: false, error: null });
  },
  reset: () => set({ ...defaults, loading: false, error: null }),
}));
