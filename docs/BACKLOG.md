# Backlog

Enhancements that reviewers defer land here; the product manager ranks them (docs/PLAN.md, section 8).

- QR verification on portfolio PDFs, when the quality unit asks for it.
- Department and term comparisons, after two terms of data.
- Surveys: trainers about the platform, trainees about courses.
- Word export of the portfolio.
- The dark theme and the English interface.
- Entra sign-in, SharePoint storage and Teams notifications, after approval and on a host that can reach Microsoft's cloud (ADR-0008).
- Email through SMTP and web push (VAPID), after the hosting decision; an isolated server can send neither (ADR-0008, Steps 12 and 39).
- Passkeys, once the hostname and a certificate that phones trust are chosen (ADR-0008, Step 6).
- A view across colleges for the General Administration.
- A way back for the last admin who has lost both the password and the authenticator: `pnpm admin:create` refuses once the system role has a member, and only another admin can reset (Step 10). A terminal reset that is audited and needs the server's console, decided with the hosting option (Step 6).
- One-time TOTP codes: Better Auth accepts a code again within its 90-second window. Remember the last accepted step per account if the security review asks for it (Step 6, Step 40).
- Failed sign-ins in the audit log: today only a lock writes an event (`account.lock`); decide whether each failure should, with the retention setting (Steps 6 and 11).
- A remembered device's cookie lasts 90 days (Better Auth's session lifetime, the longest `auth.rememberedDeviceDays` allows) while the server ends its session at the setting, 30 days by default. Set the cookie's expiry from the setting, if a reviewer finds the longer cookie misleading (Step 6).
- Sign-in limits behind Caddy only: they key on the first `X-Forwarded-For` entry, which a client reaching the app directly could set itself (Steps 6, 40 and 41).
- One component per job (section 4): the Step 4 primitives and the BeUI pieces overlap on the text field, the checkbox, the command palette (cmdk), the sheet and drawer (vaul) and the menu, and Step 7 adds the switch, select, tabs and popover. docs/design/beui-map.md names the component for each job; in the UX review of Steps 1 to 10, remove the others from the catalog with their dependencies. The Radix sheet and the vaul drawer ease on `--duration-slow` and vaul's 0.5 s curve, and Sonner shows toasts: decide there too whether BeUI's `animated-toast-stack` replaces Sonner. From the Step 4 review, revised in Step 5 and Audit 2.

## For lead review A (audit 1-3, minors 1-5; details in docs/reviews/audit-03.md)

- Record why `cacheComponents` and `partialPrefetching` are on (`next.config.ts`) in ADR-0001, or remove them and the `connection()` calls in `/healthz` and `/readyz`. Since Step 4 the root layout reads the locale settings from the database on every request, so no route gets a static shell: ADR-0007 (proposed) sets out that choice and the cached alternative for the owner.
- Make `seed:demo` store `locale.timeZone` for the demo college, and leave `random` out of the seed context until a step reads it.
- Delete the `fs.write` monkeypatch test in `tests/integration/worker.test.ts` and the pg-pool timeout test in `tests/integration/db-client.test.ts`.
- Keep the PostgreSQL image tag in one exported test constant that a Renovate `customManagers` regex updates, instead of five copies.

## For lead review A (audit 2, steps 4-6; details in docs/reviews/audit-06.md)

- Before `/ux-review 1-10`, capture `e2e:screens` against the standalone build (or with `devIndicators: false`), so no capture shows the Next.js dev-tools button, and settle the 390 px captures' scale: the files are 1170 px wide (`scale: "css"`). Minors 5 and 6; PR #6 left the scale to the UX review.
- The `baselines` CI job pushes new screenshots to pull request branches with `contents: write`, and its CodeQL alert is still with the owner. Drop the job and commit the `visual-baselines` artifact by hand, or dismiss the alert with a written reason (minor 8).
- Serve the identity font as WOFF2 once its licence allows converting it: the two TTF files are about 150 KiB of the login page's transfer (enhancement 1). Licensed files stay unconverted until then (ADR-0004 and the font-licence item in section 8).
