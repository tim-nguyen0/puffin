import { create } from "zustand";
import type { components } from "@puffin/api-types";
import { useSettingsStore } from "./settingsStore";

export type TelemetrySample = components["schemas"]["TelemetrySample"];

interface TelemetryState {
  connected: boolean;
  latest: TelemetrySample | null;
  history: TelemetrySample[];
  ingest: (sample: TelemetrySample) => void;
  setConnected: (connected: boolean) => void;
}

export const useTelemetryStore = create<TelemetryState>((set) => ({
  connected: false,
  latest: null,
  history: [],
  ingest: (sample) =>
    set((state) => {
      const limit = useSettingsStore.getState().telemetryHistoryLimit;
      return {
        latest: sample,
        history: [...state.history.slice(-(limit - 1)), sample],
      };
    }),
  setConnected: (connected) => set({ connected }),
}));

let socket: WebSocket | null = null;

export function connectTelemetry(url = useSettingsStore.getState().wsUrl): void {
  if (socket) return;
  socket = new WebSocket(url);
  const { ingest, setConnected } = useTelemetryStore.getState();
  socket.onopen = () => setConnected(true);
  socket.onmessage = (event) => ingest(JSON.parse(event.data) as TelemetrySample);
  socket.onclose = () => {
    setConnected(false);
    socket = null;
  };
}

export function disconnectTelemetry(): void {
  socket?.close();
  socket = null;
}
