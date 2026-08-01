import createClient from "openapi-fetch";
import type { paths } from "@puffin/api-types";
import { useSettingsStore } from "./settingsStore";

type Client = ReturnType<typeof createClient<paths>>;

let client: Client = createClient<paths>({ baseUrl: useSettingsStore.getState().apiBaseUrl });

useSettingsStore.subscribe((state, previous) => {
  if (state.apiBaseUrl !== previous.apiBaseUrl) {
    client = createClient<paths>({ baseUrl: state.apiBaseUrl });
  }
});

export const api: Client = new Proxy({} as Client, {
  get: (_target, property) => Reflect.get(client, property),
});

export function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "detail" in error) {
    const detail = (error as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}
