import createClient from "openapi-fetch";
import type { paths } from "@puffin/api-types";
import { useSettingsStore } from "./settingsStore";

type Client = ReturnType<typeof createClient<paths>>;

// callers keep one stable `api`; the client underneath follows the base url
// configured on the settings screen
let client: Client = createClient<paths>({ baseUrl: useSettingsStore.getState().apiBaseUrl });

useSettingsStore.subscribe((state, prev) => {
  if (state.apiBaseUrl !== prev.apiBaseUrl) {
    client = createClient<paths>({ baseUrl: state.apiBaseUrl });
  }
});

export const api: Client = new Proxy({} as Client, {
  get: (_target, prop) => Reflect.get(client, prop),
});
