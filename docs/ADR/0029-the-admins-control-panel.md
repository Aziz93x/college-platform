# ADR-0029: The admin's control panel: a console, the system's state, sessions and the platform's words

- Status: accepted (2026-10-23): the owner's request and their answers to three questions
- Date: 2026-10-23
- Source: the owner's request of 23 October 2026 ("Admin must have controls all over the app, like a real control panel"); docs/PLAN.md section 1 (the system admin's home is the admin console, and they see the audit log, system health and backups); Steps 7, 9, 10, 11, 20 and 42

## Context

The system admin's role holds every key across the college, so every page and every action is already theirs: the college, departments, roles and their keys, people and their accounts, all the settings, the audit log, terms, the framework, Rayat, sections, plans and assignments. A control panel still lacks four things:

1. **A home.** Section 1 names the "admin console" as the system admin's home screen, but no step builds it. Today has nothing for the admin and leads to their next page.
2. **The system's state.** Nothing shows whether the database, the job queue and the worker run, which version runs, or how the generation engine's passes went. Step 42 adds errors and backups, late in the plan.
3. **Sessions.** No screen shows where someone is signed in, and nothing signs them out short of disabling their account.
4. **The platform's words.** Every label and message is data in `messages/ar.json`, which only a release changes.

The owner chose all four on 23 October 2026, no viewing the app as someone else, and to build them now, before Step 22.

## Decision

1. **Three keys**, which the system role holds at once, as it holds every key in code; the roles grid gives them to others:
   - `system.manage` (platform, two-factor): the system page, re-running a failed pass, and signing everyone else out;
   - `accounts.sessions` (organization, two-factor): a person's sessions, signing them out, and requiring a new password at their next sign-in. Held in a department, it reaches that department's people, as `accounts.resetPassword` does;
   - `texts.manage` (platform, two-factor): the platform's words.
2. **The console, `/console`**, the first page of the administration group, for whoever holds a key of that group across the college. It shows only what the viewer's keys open:
   - the college at a glance: its people by account state, its departments and roles, and the term on view;
   - what needs attention, each linked to its page: locked accounts, people with no role, a failed pass, a worker not seen for three minutes, a Rayat report waiting to be applied;
   - the latest changes from the audit log;
   - a tile for each administration page.

   The system admin's page order puts it after Today, so their Today and their phone's second tab lead there. Step 23 keeps it as their home.
3. **The system page, `/system`:**
   - checks: the database answers and how long it took, the job queue is installed, the worker beat within three minutes, the database's size, the version, and how long the app has run;
   - the worker's heartbeat job writes the time of each beat to `worker_heartbeats`, which the page reads;
   - the college's generation passes, the latest first, with their reason, term, state, counts and error. A failed pass is run again as a new pass whose reason is `admin`;
   - how many sessions are signed in now, and signing everyone else out, which asks for the password again.

   Step 42 adds the errors and the backups to this page.
4. **Sessions, on a person's page:**
   - each session's device and browser, read from its user agent, its address, when it signed in, when it was last seen, and whether it is remembered;
   - signing out one session or all of them, and requiring a new password, which the shell asks for on the person's next request;
   - the viewer's own session is marked, and they end it by signing out.

   The events are `session.revoke`, `session.revokeAll`, `account.requirePasswordChange` and, from the system page, `session.revokeEveryone`.
5. **The platform's words, `/texts`:**
   - every message of `messages/ar.json` by its key, with the college's wording where it changed; a search by key or words, and a filter for the changed ones;
   - a change is stored per college in `text_overrides`. next-intl's request configuration lays the college's changes over the catalog, read once per request, so every page and client component shows them;
   - a change must parse as an ICU message and keep the default's arguments (the names in braces, and each plural's and select's own) and tags; otherwise it is refused with the reason;
   - "reset to default" deletes the change. A change whose key a release removed is ignored;
   - `text.override` and `text.reset` record the wording before and after.
6. **No viewing as someone else** (the owner's answer): sign-in stays personal, and the audit log says who did what.

## Consequences

- The admin's home exists before Step 23, which keeps it and adds the readiness board to it (Step 22).
- A college's wording survives releases while its key stays. A release that renames a key leaves the old wording unused, and the editor shows the new key with the default.
- The worker writes one row a minute, and the app reads it only on the system page and the console.
- Migrations: the system role's page order, `worker_heartbeats`, `text_overrides`, and `admin` as a pass's reason.
