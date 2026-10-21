# College Platform
Arabic-first platform where each role fills its part of one loop: term and framework (vice-dean)
-> department plan (head) -> tasks per trainer and section -> evidence -> review -> portfolios and indicators.

## Rules
- Work on one step of docs/PLAN.md at a time; never start the next step. /step resumes a step in progress.
- Before coding, state assumptions and a "step -> verify" plan. If anything is unclear, ask.
- Items marked "You:" in a step belong to the owner: stop and hand over a checklist.
- Capabilities in code, everything else in data: no names, labels, week counts, role names, limits,
  colors or Arabic text in src/. Use settings, the database or messages/*.json.
- Nothing is fetched from the internet at runtime (fonts, scripts, wasm, images, PDF assets):
  the platform may run on an isolated network.
- Every server action: next-safe-action, a Zod input schema, authorize(actor, permission, scope),
  and an audit event. Check permissions by key, never by role name.
- Modules import each other only through index.ts; domain/ has no I/O.
- Every behavior change comes with a test that fails without it.
- Write the minimum code that solves the step; no speculative abstractions.
- Extend pnpm seed:demo with realistic data for everything you add.
- Every screen: loading, empty, partial, error and no-permission states (offline from Step 39);
  right-to-left; phone first.

## Commands
pnpm dev | pnpm check:all | pnpm test | pnpm test:e2e | pnpm e2e:screens
pnpm db:generate | pnpm db:migrate | pnpm db:seed | pnpm seed:demo | pnpm admin:create | pnpm identity:sync
pnpm local:up | pnpm local:down | pnpm local:share | pnpm local:run
