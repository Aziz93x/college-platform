# ADR-0010: The JavaScript budget per route

- Status: proposed (the owner chooses before Step 40 makes the budgets fail CI)
- Date: 2026-10-21
- Source: docs/PLAN.md section 4 ("JavaScript per route: 170 KB gzipped or less"), Step 6's "Done when" and Step 40; Audit 2, major 1 (docs/reviews/audit-06.md)

## Context

Section 4 budgets 170 KB of gzipped JavaScript per route. Measured with Lighthouse on phone emulation after Audit 2, the login page loads 17 scripts, 246.6 KiB on the wire (252,550 bytes), and Today 248.0 KiB (253,988 bytes). Before Audit 2 moved Sonner's toaster to `/design`, they were 257.2 and 258.6 KiB.

Lighthouse's transfer sizes for the login page break down as follows:

| Part | About |
| --- | --- |
| React and Next.js: react-dom, the app router, the RSC client, `next/image` and head, Turbopack's runtime | 145 KiB |
| Motion and its feature bundle, on every page from the root layout | 51 KiB |
| next-intl's message formatter | 13 KiB |
| tailwind-merge | 9 KiB |
| The platform's own code | the rest, about 29 KiB |

React and Next.js alone leave 25 KiB of the 170 for everything else: the message formatter and tailwind-merge take 22 of them, and the platform's own code is about 29 KiB.

## Options

- **A. Hold 170 KB.** Take Motion and the BeUI pieces built on it off every route, and move message formatting and class merging off the client. This undoes the owner's direction for motion (docs/design/beui-map.md), and the 25 KiB left after React and Next.js is still less than the platform's own code today (about 29 KiB).
- **B. A measured budget (recommended).** 250 KiB of script per route on the wire (256,000 bytes), which Lighthouse CI asserts as an error from Step 40. Every step that adds client code keeps the routes under it, and Step 40 tries to keep Motion's feature bundle off the routes that do not animate.
- **C. Budget the platform's own code only.** 170 KB for everything but React and Next.js. This needs a bundle analysis per route that Lighthouse does not give, so it adds a script to maintain.

## Decision (proposed)

B: 250 KiB of script per route on the wire. Section 4's line changes to it when the owner accepts.

## Consequences

- Until then, `lighthouserc.json` warns when a route's scripts pass 170 KiB (174,080 bytes), so every CI run shows the gap. Step 40 replaces the warning with the chosen budget as an error.
- A library that adds client code on every route has to fit under the budget, or the budget changes in a new ADR.
