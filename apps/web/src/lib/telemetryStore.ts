import { create } from "zustand";
import type { components } from "@puffin/api-types";

export type TelemetrySample = components["schemas"]["TelemetrySample"];

const HISTORY_LIMIT = 600;

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
    set((state) => ({
      latest: sample,
      history: [...state.history.slice(-(HISTORY_LIMIT - 1)), sample],
    })),
  setConnected: (connected) => set({ connected }),
}));

let socket: WebSocket | null = null;

export function connectTelemetry(url = `ws://${window.location.host}/ws/telemetry`): void {
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
