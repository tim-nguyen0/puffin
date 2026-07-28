import createClient from "openapi-fetch";
import type { paths } from "@puffin/api-types";

export const api = createClient<paths>({ baseUrl: "/api" });
