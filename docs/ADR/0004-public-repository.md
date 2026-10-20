# ADR-0004: A public repository, with licensed assets kept out of git

- Status: accepted (the owner chose a public repository on 2026-10-20, in the Step 2 session)
- Date: 2026-10-20
- Source: docs/PLAN.md, Step 1, "Create the private repo", and Step 4

## Context

Step 1 asks for a private repository. `Aziz93x/college-platform` was created public in Step 1, and nothing recorded the change (Audit 1, major 4).

On GitHub Free, a private repository gets no branch protection, no rulesets and no CodeQL code scanning. Step 2 requires both: `main` protected by the required checks, and CodeQL. A public repository gets both at no cost.

A public repository publishes everything committed to it. Step 4 would otherwise commit the DIN Next LT Arabic font files from `Aziz93x/identity-design`. Those fonts are licensed through the owner's employer (docs/PLAN.md, section 4), so committing them here would republish them. Steps 1 to 3 committed no font or brand file.

## Decision

The repository stays public.

Licensed or non-public brand assets, such as font files and logos that are not public, never enter git. `.gitignore` already ignores every `.woff`, `.woff2`, `.ttf` and `.otf` file and the whole `public/brand/` folder, and `tests/unit/licensed-assets.test.ts` fails when those entries are removed or such a file is tracked anyway, for example with `git add -f`. `pnpm identity:sync` fetches them from the pinned commit of the identity repo: on the laptop, in CI and in the Docker build. `next/font/local` reads every font file at build time, so `pnpm build` fails without them, and CI and the Docker build must fetch them before they build. The metric-matched fallback font covers only the moment before the font loads in the browser.

## Consequences

- Step 4 implements the fetch: the download in `identity:sync`, and the same fetch in CI and in the Docker build before `pnpm build`. The gitignore entries exist since Audit 1.
- Demo data stays synthetic. Seeds, fixtures and screenshots hold no real staff names, employee numbers or college documents.
- GitHub reports `Aziz93x/identity-design` itself as public. The owner should check whether it holds the font files. If it does, they are already published there, and the license question applies to that repository too.
- If the identity repo becomes private, CI and the Docker build need a read-only token for it, stored as a CI secret and passed to Docker as a build secret, never as a build argument.
- Branch protection is free here, but it is not on yet. The owner adds the ruleset on `main` that Step 2 requires (Audit 1, major 1).
- This ADR records the deviation from Step 1. docs/PLAN.md gets one note under Step 4 that points here, so a Step 4 session reads the rule.

## Alternative

Make `college-platform` private. That hides the code from now on, but what was already pushed may have been cloned. On GitHub Free it also loses branch protection, rulesets and CodeQL code scanning, so keeping them needs a paid plan. The rule for licensed assets above applies either way, so the choice does not block Step 4.
