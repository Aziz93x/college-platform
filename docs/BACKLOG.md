# Backlog

Enhancements that reviewers defer land here; the product manager ranks them (docs/PLAN.md, section 8).

- QR verification on portfolio PDFs, when the quality unit asks for it.
- Department and term comparisons, after two terms of data.
- Surveys: trainers about the platform, trainees about courses.
- Word export of the portfolio.
- The dark theme and the English interface.
- Entra sign-in, SharePoint storage and Teams notifications, after approval.
- A view across colleges for the General Administration.
- A one-shot `migrate` service in docker/compose.yml, so the production stack gets its tables before Step 41: copy db/ into the worker image, run `node db/migrate.ts`, and make app and worker depend on it with `condition: service_completed_successfully`. From audit 1-3; it overlaps Step 41.
- Springs for sheets and drawers (section 4): the sheet eases on `--duration-slow` and the drawer keeps vaul's 0.5 s curve. Choose a spring (a CSS `linear()` curve or Motion) and its duration in the UX review of Steps 1 to 10. From the Step 4 review.
- A database user for the app that neither owns the tables nor is a superuser, with migrations kept on the owner, so the `audit_events` triggers bind the app too: today the app connects as the owner, which can disable them. From audit 1-3; it fits Step 11 or Step 41.

## For lead review A (audit 1-3, minors 1-5; details in docs/reviews/audit-03.md)

- Record why `cacheComponents` and `partialPrefetching` are on (`next.config.ts`) in ADR-0001, or remove them and the `connection()` calls in `/healthz` and `/readyz`. Since Step 4 the root layout reads the locale settings from the database on every request, so no route gets a static shell: ADR-0007 (proposed) sets out that choice and the cached alternative for the owner.
- Drop `SMTP_URL` from the environment schema, the env examples, compose, CI and the test harness until Step 12 adds the SMTP adapter as optional.
- Make `seed:demo` store `locale.timeZone` for the demo college, and leave `random` out of the seed context until a step reads it.
- Delete the `fs.write` monkeypatch test in `tests/integration/worker.test.ts` and the pg-pool timeout test in `tests/integration/db-client.test.ts`.
- Keep the PostgreSQL image tag in one exported test constant that a Renovate `customManagers` regex updates, instead of five copies.
