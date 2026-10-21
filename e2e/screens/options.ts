import { join } from "node:path";
import { devices } from "@playwright/test";

// pnpm e2e:screens captures each route for each role at these widths, for the UX reviews.
export const SCREEN_WIDTHS = [390, 768, 1440] as const;
// Who the capture signs in as: nobody, or a demo role e2e/auth.setup.ts signs in.
const KNOWN_ROLES = ["anonymous", "trainer", "admin"];

// One Playwright project per width. The phone width is captured as a phone, with touch, a mobile
// viewport and its pixel ratio, so coarse-pointer styles apply as they do on a real phone.
export const screenProjects = SCREEN_WIDTHS.map((width) => ({
  name: String(width),
  use: {
    ...(width === SCREEN_WIDTHS[0]
      ? { ...devices["iPhone 15"], browserName: "chromium" as const }
      : devices["Desktop Chrome"]),
    viewport: { width, height: 900 },
  },
}));

const list = (value: string | undefined, fallback: string) => [
  ...new Set((value?.trim() || fallback).split(/[\s,]+/)),
];

// "/" is "index" and "/a/b?c=d" is "a-b-c-d".
const slugOf = (route: string) =>
  route.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "index";

// SCREENS_ROUTES: routes separated by spaces or commas (default "/"); SCREENS_OUT: the folder
// (default .local/screens); SCREENS_ROLES: who signs in (default anonymous; trainer or admin).
export function screensOptions(env: Record<string, string | undefined>) {
  const routes = list(env.SCREENS_ROUTES, "/");
  const roles = list(env.SCREENS_ROLES, "anonymous");
  const route = routes.find((route) => !route.startsWith("/"));
  if (route) throw new Error(`SCREENS_ROUTES: "${route}" must start with /`);
  // The captures run in parallel, so two routes with one file name would overwrite each other.
  const bySlug = new Map<string, string>();
  for (const route of routes) {
    const other = bySlug.get(slugOf(route));
    if (other) {
      throw new Error(
        `SCREENS_ROUTES: "${other}" and "${route}" would be saved under the same file name`,
      );
    }
    bySlug.set(slugOf(route), route);
  }
  const role = roles.find((role) => !KNOWN_ROLES.includes(role));
  if (role) {
    throw new Error(
      `SCREENS_ROLES: "${role}" is not one of ${KNOWN_ROLES.join(", ")}`,
    );
  }
  return { routes, roles, out: env.SCREENS_OUT?.trim() || ".local/screens" };
}

// <out>/<role>/<route-slug>-<width>.png.
export function screenPath(
  out: string,
  role: string,
  route: string,
  width: number | string,
) {
  return join(out, role, `${slugOf(route)}-${width}.png`);
}
