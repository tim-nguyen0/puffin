import createClient from "openapi-fetch";
import type { paths } from "@puffin/api-types";

export const api = createClient<paths>({ baseUrl: "/api" });

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
