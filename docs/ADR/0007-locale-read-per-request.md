# ADR-0007: The document language is read from the settings on every request

- Status: proposed (Step 4 implements the per-request read; the owner chooses between it and the cached alternative before Step 5 measures the Lighthouse targets)
- Date: 2026-10-20
- Source: docs/PLAN.md, Step 4 ("The root layout takes language and direction from settings"), section 4 (measurable bar) and Steps 5 to 7; the Step 4 review

## Context

Step 4 asks the root layout to set `<html lang dir>` from the settings. The language is the college setting `locale.language` in PostgreSQL; the direction follows from it. next-intl also needs the college's time zone, `locale.timeZone`, so that dates are formatted in Asia/Riyadh and not in the server's zone.

Cache Components are on (`next.config.ts`). A value read from the database must then either wait behind a Suspense boundary or make the route block. `<html>` is the document itself, so it cannot wait behind a Suspense boundary, and `next build` has no database to read.

## Decision (as implemented in Step 4)

next-intl's request config (`src/i18n/request.ts`) reads the deployment's college (`findCollegeId`), then `locale.language` and `locale.timeZone` in parallel, on every request. The root layout awaits `connection()` first, so the build never reads them, and exports `instant = false`, which lets the route block on that read.

## Consequences

- No route gets a static shell. Every page, the not-found page included, waits for two database round trips before its first byte. This bears on Step 5's Lighthouse performance target (95 or more) and on Step 6's LCP under 2.0 s on 4G.
- `instant = false` on the root layout turns off Next's instant-navigation validation for the whole app; Next's documentation places it as low in the tree as possible.
- Every page depends on the database. With PostgreSQL down, or with a stored `locale.language` that fails its schema (`getSetting` throws), every route fails in the root layout, not only `/readyz`. A segment `error.tsx` cannot catch an error thrown by the root layout; only `src/app/global-error.tsx` can. None exists yet, so users would see Next's built-in English error page. Step 5's `global-error.tsx` must render without the database: its own `<html lang dir>` from the registered default language, and its messages imported statically.
- `next build` reads neither the environment nor the database; CI builds with them empty, as the Docker build does.

## Alternative

Cache the locale settings with `"use cache"` and a cache tag per college, and let Step 7's settings action invalidate the tag when a value changes. Routes would then get their static shells back after the first request, and the database would be read once per change instead of once per request. The costs: a cache tag and its invalidation in Step 7's `setSetting`, and the first request after each deploy still reads the database, so a database that is down at that moment still fails every page.

## Owner decision needed

Keep the per-request read (the simplest; costs the static shells and ties every page to the database) or move to the cached settings when Step 7 adds `setSetting`.

## Update (Step 5)

With the locale read on every request no navigation can be instant, so `next.config.ts` sets `experimental.instantInsights.validationLevel` to `"manual-warning"`: development validates only the segments that set `instant`. If the owner chooses the cached alternative, return to the default level, so every page is validated again.
