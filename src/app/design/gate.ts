import type { Env } from "@/platform/config/env";

// /design serves the token and component catalog for development: on a laptop only. Staging and
// production are deployed without sign-in so far, so they answer 404 (src/proxy.ts) until Step 6
// adds sign-in and an admin permission key.
export function isDesignCatalogEnabled(env: Pick<Env, "APP_ENV">) {
  return env.APP_ENV === "local";
}
