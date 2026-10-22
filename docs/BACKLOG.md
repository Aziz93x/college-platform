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

- Serve the identity font as WOFF2 once its licence allows converting it: the two TTF files are about 150 KiB of the login page's transfer (Audit 2, enhancement 1). Licensed files stay unconverted until then (ADR-0004 and the font-licence item in section 8). Lead review A left it here.
- Sign the image archives that updates bring on approved media: `SHA256SUMS` on the same medium proves the copy is whole, not that it came from the owner. A detached signature (minisign, or `cosign sign-blob` with a key the owner keeps), checked by `pnpm local:up --images`, gives an isolated server authenticity without a registry. About 1 h plus keeping the key; Step 40's dependency audit could own it (Audit 3, enhancement 2).

## UX review 1: should fix (docs/reviews/ux-10.md)

Every score is 4 or above without these; the review ranks them after its must-fix items, which its PR fixed.

- S1. Motion over the 200 ms token: the login wave (1 s), the text reveal (about 1.1 s), the status page's code and art, the page header's eyebrow, the sidebar's links and fold, the badge's colour, the bloom menu, the checkbox and the field's shake; the stepper's elastic curve and the row actions' and slider's under-damped springs. Move them to `--duration-fast` or `--duration-slow` on the standard curve and critically damped springs; the sheets keep their glide.
- S2. Tokens: glow tokens for the three radial gradients, the sidebar's glow and the inset shadows; the bell's count on `text-xs` and `h-5 min-w-5`; `rounded-xl` for the bloom menu's panel; `--shadow-*` for the two `rgb()` shadows (Steps 11 and 12); let `scripts/check-hardcode.mjs` catch `_rgb(`.
- S3. One accent per view: drop the wave from the page header (`sm:pb-16` to `sm:pb-8`), which also makes the desktop's largest paint text.
- S4. Copy and numbers: the import's counts as an ICU message with a formatted number; page-order positions and import line numbers through `format.number`; the settings default line quotes its value; the sign-in help names heads as well as the platform admin; the platform name's description says where the college's names are edited.
- S5. Smaller finish: the login page's 40 px desktop scroll and the tablet panel's alignment; the page search's empty footer strip on touch; `font-sans` for the header's `Ctrl K`; a skeleton of the profile's own; a way back to the list from an unknown record's 404; a stage line on the import; the page order's phone cut-off; a copy button for the two-factor key and backup codes; the profile's two-factor state as a badge; icon-only row actions on a phone, whose open bar covers the name (the touch check still finds that name link, `people-row-actions-390`).
- Later: a filter for a role's members (the trainer role lists 40 before its add form), and a sticky header for the people table (47 rows).
- A seven-day calendar cannot give 44 px days on a 320 px phone: the date range picker reaches 44 px from 360 px (UX review 1). Decide with Step 13, which uses it for holidays, whether a narrow phone gets a list of weeks instead.

## Lead review A: proposals waiting for the owner (docs/reviews/lead-A.md)

Each one that the owner accepts gets an ADR and a note under its step before it is built (`/lead-review`).

- 1. Sign-in opens the first page the person must see (`/change-password` or `/two-factor/setup`) instead of going through Today. About 1 h; no plan change.
- 2. "Remember this device" ticked by default on phones and tablets (`auth.rememberByDefault`), for the metric "sign-ins per completed task". 45 min; ADR-0012.
- 3. Decide ADR-0007: keep `cacheComponents` and `partialPrefetching` and record why in ADR-0001 (10 min), and cache the college and its settings in Step 7 (about 2 h). Pages now run 11 to 16 database statements. If the owner keeps the per-request read instead, remove both flags and the `connection()` calls (about 1 h). This settles the Audit 1 item on those flags.
- 6. Give section 4's server budget a load level (for example 20 concurrent requests) and a one-minute load run in Step 41's CI smoke: reads take p95 23 to 30 ms one at a time, 291 to 310 ms at 10 at once. 1 h 15 min; extends ADR-0010.
- 7. Replace the temporary password on the sign-in card itself: a new trainer's first sign-in goes from 4 page views to 2 and from 83 typed characters to 46 or 71. About 3 h; ADR-0012.
- 9. Give the two sign-in limits different jobs (5 per identifier and address, 20 overall) and add a ceiling of failures per address, in Step 40. 1.5 h; amends ADR-0009.
- 10. Migrations expand, then contract, and each states its inverse; Step 42's drill runs the previous image on the migrated database. 1.5 h; ADR-0011.
- 11. End two-factor setup without the redirect bounce through `/`, so ADR-0009 #9's full page load holds on that path. 1 h; no plan change. (ADR-0014 removed the bounce: the setup's last step now sends the person on itself, with the router; the full page load there is what remains.)
