import type { components } from "@puffin/api-types";
import { create } from "zustand";
import { api, apiErrorMessage, authHeaders } from "./api";
import { useSettingsStore } from "./settingsStore";

type User = components["schemas"]["User"];

interface AuthState {
  token: string | null;
  user: User | null;
  initialized: boolean;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restore: () => Promise<void>;
}

const TOKEN_KEY = "puffin-token";

function savedToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}

async function finishLogin(token: string, user: User) {
  window.localStorage.setItem(TOKEN_KEY, token);
  await useSettingsStore.getState().load(token);
  return { token, user, initialized: true, loading: false, error: null };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: savedToken(),
  user: null,
  initialized: false,
  loading: false,
  error: null,
  login: async (email, password) => {
    set({ loading: true, error: null });
    const { data, error } = await api.POST("/auth/login", {
      body: { email, password },
    });
    if (error || !data) {
      const message = apiErrorMessage(error, "Could not log in");
      set({ loading: false, error: message });
      throw new Error(message);
    }
    set(await finishLogin(data.token, data.user));
  },
  signup: async (email, password) => {
    set({ loading: true, error: null });
    const { data, error } = await api.POST("/auth/signup", {
      body: { email, password },
    });
    if (error || !data) {
      const message = apiErrorMessage(error, "Could not create account");
      set({ loading: false, error: message });
      throw new Error(message);
    }
    set(await finishLogin(data.token, data.user));
  },
  logout: async () => {
    const token = get().token;
    try {
      if (token) {
        await api.POST("/auth/logout", { headers: authHeaders(token) });
      }
    } finally {
      window.localStorage.removeItem(TOKEN_KEY);
      useSettingsStore.getState().reset();
      set({ token: null, user: null, initialized: true, loading: false, error: null });
    }
  },
  restore: async () => {
    const token = get().token;
    if (!token) {
      set({ initialized: true });
      return;
    }

    const { data, error } = await api.GET("/auth/me", {
      headers: authHeaders(token),
    });
    if (error || !data) {
      window.localStorage.removeItem(TOKEN_KEY);
      set({ token: null, user: null, initialized: true });
      return;
    }
    await useSettingsStore.getState().load(token);
    set({ user: data, initialized: true, error: null });
  },
}));
