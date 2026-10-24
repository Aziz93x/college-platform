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
- Escape on a select's or a combobox's open list inside a sheet closes the whole sheet: the sheet's focus trap hears the key on the document before the list's listener on the window does. The search field clears its text first and keeps the sheet (Step 21, Audit 7). Give the select and the combobox the same handling, each with a test in a sheet: the item sheet's kind, the assign sheet's weeks, the transfer sheet's trainer. About 30 min.
- Tell a person when a head gives them an assignment or revokes it. Today only a template that grants a role tells them, through its membership's notification (Step 21). One notification kind, which Step 27, whose rule is "few messages, all useful", should decide on.

- Sign the image archives that updates bring on approved media: `SHA256SUMS` on the same medium proves the copy is whole, not that it came from the owner. A detached signature (minisign, or `cosign sign-blob` with a key the owner keeps), checked by `pnpm local:up --images`, gives an isolated server authenticity without a registry. About 1 h plus keeping the key; Step 40's dependency audit could own it (Audit 3, enhancement 2).

## Audit 4 (docs/reviews/audit-12.md)

- A calendar sweep in CI: each night, `seed:demo` with the clock moved to each day of the week (a 12-line preload around `Date`), then the specs that read demo data (`--grep-invert @database`). It finds a test that passes only on some days before it turns CI red, as the notification tests did; Step 13's terms and Step 27's reminders add more rules about dates. About 1 h, plus seven short runs a night (enhancement 2).
- A random stream per record in the demo seed: each person's and each week's draws from `createRandom(hash(seed, key))` instead of one shared stream, so a new draw, or the calendar, no longer shifts every later person's data. Audit 4 fixed the demo trainer's notifications by hand; this removes the cause for the rest. About 1 h, and the demo data changes once: do it with Step 43's larger seed (enhancement 3).

## Audit 5 (docs/reviews/audit-15.md)

- A guard for the production stack's list of specs: a unit test that fails on any `e2e/*.spec.ts` that is neither in `e2e/stack.config.ts`'s `testMatch` nor named in a short list of excluded specs, each with its reason. Audits 4 and 5 each found specs missing from the list. Writing it means recording why the design catalog's, the identity font's and the streaming specs stay out today, which nothing says; `announcements.spec.ts` stays out because each of its tests makes accounts in the database. About 30 min (enhancement 1).
- The calendar sweep above, without moving the clock: a clock moved months ahead signs the demo trainer out (Audit 5, P1). One college holiday over this week, inserted before `seed:demo`, gives the state of a day in an Eid break, and the specs that read demo data then run on it (`--grep-invert @database`). About 1 h, plus one short run a night (enhancement 3).

## Audit 6 (docs/reviews/audit-18.md)

- For the owner: show a head every published framework item their trainers receive, those for the trainer's role too, and warn in the sheet when a template has the kind and reach of one of them ("يطلب الإطار العام هذا من المدربين: «…»"), so Step 20 never generates the same work twice. About 45 min; a flow proposal, so an ADR and a note under Step 19, whose plan shows the inherited items locked, once the owner accepts it (enhancement 3).

## Audit 7 (docs/reviews/audit-21.md)

For the owner, two choices the steps made without saying so:

- An empty draft is never published (`publishPlan()` refuses it), so a department cannot take back all of its own items for the rest of a term. Either allow publishing an empty version, or keep the refusal and say so in the editor.
- An assignment whose weeks are already over is accepted, and its tasks are overdue at once: the demo's schedule coordinator, for weeks 1 to 4, is given in week 9. Either refuse a range that has ended, or keep it for recording past work.

## UX review 1: should fix (docs/reviews/ux-10.md)

Every score is 4 or above without these; the review ranks them after its must-fix items, which its PR fixed.

- S1. Motion over the 200 ms token: the login wave (1 s), the text reveal (about 1.1 s), the status page's code and art, the page header's eyebrow, the sidebar's links and fold, the badge's colour, the bloom menu, the checkbox and the field's shake; the stepper's elastic curve and the row actions' and slider's under-damped springs. Move them to `--duration-fast` or `--duration-slow` on the standard curve and critically damped springs; the sheets keep their glide.
- S2. Tokens: glow tokens for the three radial gradients, the sidebar's glow and the inset shadows; the bell's count on `text-xs` and `h-5 min-w-5`; `rounded-xl` for the bloom menu's panel; `--shadow-*` for the two `rgb()` shadows (Steps 11 and 12); let `scripts/check-hardcode.mjs` catch `_rgb(`.
- S3. One accent per view: drop the wave from the page header (`sm:pb-16` to `sm:pb-8`), which also makes the desktop's largest paint text.
- S4. Copy and numbers: the import's counts as an ICU message with a formatted number; page-order positions and import line numbers through `format.number`; the settings default line quotes its value; the sign-in help names heads as well as the platform admin; the platform name's description says where the college's names are edited.
- S5. Smaller finish: the login page's 40 px desktop scroll and the tablet panel's alignment; the page search's empty footer strip on touch; `font-sans` for the header's `Ctrl K`; a skeleton of the profile's own; a way back to the list from an unknown record's 404; a stage line on the import; the page order's phone cut-off; a copy button for the two-factor key and backup codes; the profile's two-factor state as a badge; icon-only row actions on a phone, whose open bar covers the name (the touch check still finds that name link, `people-row-actions-390`).
- Later: a filter for a role's members (the trainer role lists 40 before its add form), and a sticky header for the people table (47 rows).
- A seven-day calendar cannot give 44 px days on a 320 px phone: the date range picker reaches 44 px from 360 px (UX review 1). Decide with Step 13, which uses it for holidays, whether a narrow phone gets a list of weeks instead.

## UX review 2: should fix (docs/reviews/ux-20.md)

Every score is 4 or above without these. The review's pull request fixed its must-fix items; there, the payload editors on `/design` became part of Step 26's Done when (decision 3), the audit log's words for items and the vice-dean's phone tabs were fixed (F4 and F3), and of these it also did the plan's empty state's copy (S3, its first item) and the plan bar's half step (S6, its last).

- S1. Motion over the 200 ms token, added by this range: the term switcher's morph (a 260 ms spring in, 200 ms out, `popover-morph.tsx:214-215`) and the bell's stack (320 and 260 ms, `notification-stack.tsx:129,132`). With UX review 1's S1: `--duration-slow` on the standard curve.
- S2. Numbers and plurals.
  - Simple ICU arguments ignore the digits setting: with `nu-arab`, "الأسبوع {week}" stays "الأسبوع 9" while "{count, plural, …}" gives "٣ أسابيع". Format each numeric placeholder (`{week, number}`) in `shell.term.week`, `today.term.week`, `terms.*`, `framework.dueText.week`, `plan.list.week`, `plan.grid.*`, `sections.*`, `rayat.*`, `announcements.list.reads` and `framework.publishedVersion`, and add a catalog test that every numeric placeholder is formatted.
  - Number agreement after a bare number: "كل {every} أسابيع" reads "كل 2 أسابيع" for 2, the sheet's default; "{weeks} أسبوعًا" in the plan's review load and "{capacity} مقعدًا" in sections are wrong under 11. Make each a plural.
- S3. Copy.
  - The next-term sheet names the calendar and the exam periods: say that the framework and each department's plan come too, as drafts.
  - The "مهام الفصل" card lists zeros ("وعُدِّلت 0، وانتقلت 0 إلى مدرب آخر، وأُلغيت 0"): name only what changed.
  - Evidence lines list both JPG and JPEG: show the one name people use.
  - Read-only viewers of a transfer conflict read "أبقِ النقل حتى التقرير التالي، أو ألغِه": say who keeps or cancels it.
  - A transfer's event names the new trainer "الشخص" ("المدرب الجديد") and the previous one by number (by name).
  - Term events read "إضافة إلى تقويم الفصل الفصل التدريبي…": separate the subject with "·", or drop "الفصل" from the actions' names.
  - The exam periods' overlap error asks to fix "الفترات المعلَّمة", but no row is marked: mark both rows.
  - `axes.empty.description` names a shell command, and a trainer reading a term's calendar reads about a setting: say what the viewer can do.
  - Sentences that name roles, which a college may rename ("وكيل التدريب"، "رئيس القسم"، "العميد"): name the key's holder, as "ينشر الخطة من يملك صلاحية نشر خطة القسم" does.
- S4. The plan editor, next.
  - Mark the exam weeks in the phone list's headings ("الأسبوع 5 · الدوري الأول"), and this week in the list and the grid.
  - The marks are 24 px, and a tablet gets the grid from 768 px: on a coarse pointer give each mark its cell's 36 by 44 px.
  - Preview in the sheet the weeks a rule lands in before saving; today only the toast says it, after the save.
  - The week field takes 14 taps to reach week 15: offer the term's weeks with their dates, as the transfer sheet's "من الأسبوع" does.
  - Seed a flagged draft item (a week after the theoretical final), so the flags have a demo state for reviews and end-to-end tests.
  - Give `/plan` the history panel, as `/terms/<id>` has, for whoever reads the log.
- S5. The kind field in the item sheet: under the select, one line from `kindFields[kind]` and the `kinds.fields.*` words saying what the trainer fills in ("يكتب المدرب: نوع الاختبار ويوم الاختبار"; "ملاحظات، اختيارية").
- S6. Smaller finish.
  - The kinds of event added by Steps 12 to 20 fall back to the history icon (`event-list.tsx:43-53`): give each its page's icon from the navigation.
  - At 390 px the college's short name is cut to "تقنية …" since the switcher joined the header: hide it when it does not fit whole.
  - A term's page and a new term load with the form's skeleton: shape it like the page.
  - Half steps: `py-3.5` on the term rows and `py-2.5` on the weeks list.
- Later:
  - What changed since the published version, item by item, before the vice-dean or a head publishes.
  - A table for sections, as docs/design/beui-map.md plans, once a department has more than about 20 (the demo has 12).
  - A head who publishes a plan cannot see the generation pass: the "مهام الفصل" card shows only to those who publish the framework.

## Lead review A: proposals waiting for the owner (docs/reviews/lead-A.md)

Each one that the owner accepts gets an ADR and a note under its step before it is built (`/lead-review`).

- 1. Sign-in opens the first page the person must see (`/change-password` or `/two-factor/setup`) instead of going through Today. About 1 h; no plan change.
- 2. "Remember this device" ticked by default on phones and tablets (`auth.rememberByDefault`), for the metric "sign-ins per completed task". 45 min; ADR-0012.
- 3. Decide ADR-0007: keep `cacheComponents` and `partialPrefetching` and record why in ADR-0001 (10 min), and cache the college and its settings in Step 7 (about 2 h). Pages now run 11 to 16 database statements. If the owner keeps the per-request read instead, remove both flags and the `connection()` calls (about 1 h). This settles the Audit 1 item on those flags.
- 6. Give section 4's server budget a load level (for example 20 concurrent requests) and a one-minute load run in Step 41's CI smoke: reads take p95 23 to 30 ms one at a time, 291 to 310 ms at 10 at once. 1 h 15 min; extends ADR-0010. Lead review B measured 16 of 20 pages over 300 ms at 10 at once.
- 7. Replace the temporary password on the sign-in card itself: a new trainer's first sign-in goes from 4 page views to 2 and from 83 typed characters to 46 or 71. About 3 h; ADR-0012. Step 10's import hands out 40 temporary passwords at once, and each of those people meets the forced change (lead review B).
- 9. Give the two sign-in limits different jobs (5 per identifier and address, 20 overall) and add a ceiling of failures per address, in Step 40. 1.5 h; amends ADR-0009.
- 10. Migrations expand, then contract, and each states its inverse; Step 42's drill runs the previous image on the migrated database. 1.5 h; ADR-0011. Lead review B found what a rollback to `v0.1-A`'s image would do on today's schema: its sign-in ignores `users.disabled_at`, so disabled accounts sign in again, and its access ignores `memberships.department_id`, so the heads' department keys count across the college.
- 11. End two-factor setup without the redirect bounce through `/`, so ADR-0009 #9's full page load holds on that path. 1 h; no plan change. (ADR-0014 removed the bounce: the setup's last step now sends the person on itself, with the router; the full page load there is what remains.)

## Lead review D (docs/reviews/lead-D.md)

The owner chose on 2026-10-23, and the review's pull request built what was chosen: M4's 12 are a department's trainers, all of them; a request's reach stays live (ADR-0032); and proposals 4 and 5 (ADR-0033). It fixed the five must-fix items and built proposals 1, 3, 6, 7 and 8 and the smaller items, but one. Waiting:

- A quick request reads the college's settings 16 or 17 times (the review's statement log): `calendarSettings()` and `getSetting()` in the service and in the pass, and next-intl's request configuration for the notice. Timed as the send makes them, 17 reads in three groups each read at once, they take 4.8 ms at the median (p95 8.4 to 10.3 ms), against 0.7 ms for one read, of a send's 168 ms. Reading them once saves about 4 ms and 16 statements a send. It passes the settings through `sendQuickRequest()`, through `generateTerm()`, which the worker and the seed also call, and through the notice's words. Take it with the load level lead review A's proposal 6 asks the owner for, where 16 statements a send weigh more.
- The `announcement` kind's hint, «ما يعلنه رئيس قسمك أو عمادة الكلية…», names roles a college may rename, the pattern UX review 2's S3 drops and the review's pull request dropped from `quickRequest`'s. A change of one text; take it with Step 27, which words the notices together.

## Lead review C: proposals (docs/reviews/lead-C.md)

The owner chose on 2026-10-22, and the review's pull request built what was chosen: proposal 1 (a task for each trainer of a section, a note under Step 20), 2 (ADR-0022), 3 (ADR-0020), 5 (ADR-0021) and 9 as a measured budget (ADR-0023); proposals 4 and 6 and the smaller items it fixed as defects. Waiting:

- 7. Tell the dean when a framework draft waits for endorsement, and the vice-dean when it is endorsed: two notification kinds. 1 h; an ADR. Not chosen now.
- 8. One upload for Rayat's three reports, each recognised by its headers and applied by one button. 2 h. The owner kept one upload a report.
- 9, its other half: Rayat's check and insert in the worker, with progress (3 to 4 h), if a college's files outgrow ADR-0023's budget.
- A digits-only check of SF01's and SO01's trainee numbers, so a column map that pointed at another column could not keep names. Low; the admin who edits the maps is trusted.

## Lead review B: proposals (docs/reviews/lead-B.md)

Each one that the owner accepts gets an ADR and a note under its step before it is built (`/lead-review`). Proposals 2 and 3 were fixed in the review's pull request; 5 and 7 are notes under Steps 43 and 40. The owner accepted proposals 1 and 6 on 2026-10-22, and the review's pull request built them: ADR-0015 (a notification opens from the bell, and a digest is read with the last of what it counts) and ADR-0016 (a role given from the person's page).

- 4. One re-authentication helper for the actions: the password schema and `confirmPassword()` are copied in three action files, and `changeBy()` in eight, with `drawn()` in four (Audit 6). 30 min; take it with the next step that adds a sensitive action.
- To watch: `e2e/people.spec.ts:488` (the account menu leads to changing the password) failed once in the review's full run, with no request after the press on the bloom menu's item, and passed 30 times since.
