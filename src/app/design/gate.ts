import type { Env } from "@/platform/config/env";

// /design serves the token and component catalog for development: on a laptop only, where
// src/app/design/page.tsx also requires design.view. Staging and production answer 404 (src/proxy.ts).
export function isDesignCatalogEnabled(env: Pick<Env, "APP_ENV">) {
  return env.APP_ENV === "local";
}
