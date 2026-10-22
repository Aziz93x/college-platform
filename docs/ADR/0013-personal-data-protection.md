# ADR-0013: Personal data protection

- Status: proposed
- Date: 2026-10-21, revised on 2026-10-22 for Steps 10 to 12 and 16, ADR-0014 and ADR-0017 as merged (#21 to #24, #29, #30 and #42)
- Source: the owner's review. The plan never named the PDPL, SDAIA, the NCA or the NDMO, and it had no privacy notice, no retention periods and no breach procedure. The record that answers it is `docs/privacy/data-protection.md`.
- Builds on:
  - ADR-0004: the public repository.
  - ADR-0005: errors tracked in the platform, and kept inside the Kingdom.
  - ADR-0009: sign-in and sessions.
  - ADR-0014: two-factor is the college's choice, off by default.
  - docs/PLAN.md: principle 4 (history is append-only), and sections 7 and 8 (the data stays in the Kingdom).
  - Step 11 as merged: `purge_audit_events()` (migration 0010), the one way past the append-only triggers, run as the table owner, and the `audit.retentionMonths` setting.

## Context

The platform keeps personal data in stages:
- **Already:** staff accounts, sessions with their IP address and user agent, sign-in counts, memberships and an audit trail. Steps 10 and 11 added people files, disabling and resets, and the audit screen with its CSV export and retention purge. Step 12 added in-app notifications, and ADR-0017 announcements with how many have read each, all kept with no end date. Step 16 added Rayat's data under trainee numbers, which includes absence and "barred for absence": every import keeps its records, applied or rolled back, and its diff keeps up to 50 of their keys per kind of change.
- **Step 25:** evidence photos, which may show a trainee's face, name or grade.
- **Step 36:** a per-person log of events with their durations, for the pilot measurement.

The college belongs to a government entity. So three sets of rules apply:
- **The PDPL and its Implementing Regulations**, in force since 14 September 2023, with the grace period over since September 2024. SDAIA is the competent authority.
- **The NCA's Essential Cybersecurity Controls**, ECC-2:2024, and its Data Cybersecurity Controls, DCC-1:2022.
- **The NDMO's rules** on classification and data management.

The plan named none of them. Some gaps are already in the code:
- **Sessions:** one never seen again keeps its IP address and user agent forever.
- **Sign-in counts:** they hold the identifier exactly as typed, until their window ends.
- **Audit events:** they keep the IP address and user agent as long as the event. Step 11's daily purge deletes whole events after `audit.retentionMonths`, 60 months by default. It is the only way past the append-only triggers, and it clears nothing earlier.
- **Leavers:** disabling an account (Step 10) ends its sessions, but keeps its password hash and two-factor secrets.
- **Failed sign-ins:** one leaves a durable record only when it locks an existing account (`account.lock`).
- **Trainee numbers:** Step 16 keeps them in every import of SF01 and SO01, applied or rolled back, and in each import's diff, with no end date.

Better Auth already deletes expired verification values whenever anyone checks a two-factor code. The rules and the full inventory are in `docs/privacy/data-protection.md`.

## Decision

1. **The record stays current.**
   - `docs/privacy/data-protection.md` is the platform's record of processing.
   - A step that stores a new kind of personal data adds its inventory row and its retention row in the same pull request.
   - The auditor agent's instructions (section 5 of the plan) gain this check.
2. **Trainee data arrives as counts.** Every use of trainee data in the plan is a count:
   - enrolled, withdrawn, dismissed and barred for absence, per section (Step 34);
   - unexcused absence, per course.

   So SF01 and SO01 are counted per section and course while parsing, and no trainee number is stored. Step 16 (#42) stores the numbers today, in `rayat_enrollments`, `rayat_absences` and each import's diff, so this decision changes it, and Step 17 builds on the counts:
   - **Kept:** status counts per section, and absence bands and averages per course.
   - **Imports:** the import's diff and its rollback work on the counts.
   - **Later need:** if a step needs a row per trainee, it stores a keyed hash of the number (HMAC-SHA-256, with a key outside the database), and amends this ADR.
   - **Effect:** the platform stores no trainee number from Rayat. A count of one can still point to one trainee, so the counts stay inside the section's scope. Item 3 of the request to the General Administration shrinks to staff data, these counts and evidence photos.
3. **Sign-in counts keep keyed hashes.**
   - **What changes:** `sign_in_attempts.key` and `sign_in_lockouts.subject` hold an HMAC-SHA-256 of what they hold today: the identifier as typed, with the address for the attempts. The key is derived from `AUTH_SECRET` with its own label.
   - **What stays the same:** lookups compute the same hash, so the lockout, the limits, Step 10's "locked" state and the reset that lifts a lockout behave as before.
   - **Cost:** rotating `AUTH_SECRET` resets the counts, which is acceptable.
4. **Retention is enforced on two paths.**
   - **A daily worker job,** as the app's database user, which already deletes these rows elsewhere:
     - sessions past the college's limits (the same rule `getSessionUser()` applies when a session is seen), and sessions past `expires_at`;
     - expired verification values, as a backstop to Better Auth's own cleanup;
     - sign-in counts past their window or lock (the same rule the next attempt applies);
     - notifications and announcements older than `privacy.notificationMonths`, 12 by default (Step 12 and ADR-0017 keep them with no end date).
   - **A second owner function, next to Step 11's `purge_audit_events()`:**
     - it clears the IP address and user agent of audit events older than `privacy.auditNetworkMonths`, and keeps the events;
     - the default is 12, and the schema refuses less, which is the ECC-2:2024 floor (2-12-3-5);
     - the trigger lets an update through only while that function runs, and only one that sets those two columns to null.

     This amends principle 4 for those two columns only. The triggers still refuse every other change, and they still bind the app.
   - **Step 11's whole-event purge stays as merged,** under `audit.retentionMonths` (60 months by default). The controller sets it from its records schedule.

   Each path logs how many rows each rule touched, and an integration test proves each rule.

   Records of the college's work are never deleted automatically. That covers tasks, evidence, reviews, portfolios and minutes. They wait for the controller's records schedule and a later ADR.
5. **A privacy page.**
   - **Where:** `/privacy`, open without signing in, like the sign-in page. Linked from the sign-in card and the account menu.
   - **Text:** in `messages/ar.json`, taken from `docs/privacy/privacy-notice.md` once the DPO approves it.
   - **From settings:**
     - the controller's name;
     - the DPO's contact;
     - the hosting entity;
     - the notice's date.
   - **Retention periods shown:** read from the settings that enforce them, so the page and the behavior never disagree. The backup period is deployment configuration, not a setting: the page reads it from that configuration, and a test checks that the two match.
6. **Leavers, imports and photos.**
   - **Leavers:** disabling an account already deletes its sessions (Step 10). It also deletes the password hash and the two-factor secrets, in the same transaction. The person and their records stay. Enabling the account again then starts from Step 10's reset, and two-factor is set up again.
   - **People files:** Step 10 already reads them in memory and stores nothing of them, as Step 16 does with Rayat files.
   - **Photos (Step 25):** the browser removes all metadata, not only the location, when it applies the orientation. The upload screen carries one line: photograph the work, not the people, and cover what the task does not need.
7. **Security events wait for Steps 40 and 42.**
   - **Step 40 chooses:**
     - an audit event for each failed sign-in on an existing account, with its address, kept 12 months, against ECC-2:2024 2-12; or
     - the counts alone, which keep less personal data.
   - **Step 40 also:** splits the Docker networks so that Caddy reaches only the app (ECC-2:2024 2-15-3-2).
   - **Step 42:** rotates the container logs and keeps security events for 12 months.
8. **Rights and access reviews.**
   - **Access requests:** a "this person's data" export for admins: the profile, the memberships and the audit events about the person. It builds on Step 11's person filter and CSV export. Each later step that stores a person's records adds them to it, so requests are answered within the 30 days the Implementing Regulations allow.
   - **Periodic access review (ECC-2:2024, 2-2-3-5):** a list of the memberships no admin has confirmed within a set period, next to the roles grid.
9. **Breaches.**
   - **The runbook:** `docs/ops/breach-response.md`, rehearsed once as a table-top exercise before go-live.
   - **SDAIA:** proposed, notified within 72 hours of every incident that touches personal data, as the October 2026 draft would require, and not only when harm is likely. The DPO confirms.
   - **Additions to the go-live checklist (section 7 of the plan):**
     - the DPO named, with their contact on `/privacy`;
     - the impact assessment done, with the authentication impact assessment for ECC-2:2024 2-2-3-2 and 2-15-3-5;
     - the retention schedule approved;
     - registration in the national register of controllers, if required;
     - a processing agreement with the host;
     - the rehearsal held.
10. **Hosting inside the Kingdom.** The platform and its backups stay inside the Kingdom, and it sends no personal data abroad.
    - ECC-1:2018 required this through its hosting control (4-2-3-3), which ECC-2:2024 deleted, referring data matters to the NDMO.
    - The rule now rests on the plan (sections 7 and 8), ADR-0005, the NDMO's rules, and SDAIA's draft amendment to the Implementing Regulations (October 2026), which would require personal data to be stored inside the Kingdom.

Not decided here: these belong to the controller and its DPO, and the checklist in `docs/privacy/data-protection.md` lists them.
- the legal basis for each purpose;
- the classification;
- the records schedule for training records;
- the DPO;
- registration in the national register of controllers;
- how trainees are told within 30 days of each import;
- whether SDAIA is notified of every incident.

## Consequences

- **The work:** decisions 3 to 6 and 8 come to about two and a half days, on top of the step in progress:
  - the hashing;
  - the daily job;
  - the second owner function, its trigger change and its migration;
  - the credentials deleted on disabling;
  - the `privacy.*` settings with their defaults;
  - the page and its messages;
  - the person's data export and the access review list;
  - their tests: a unit test for the hash, an integration test for each retention rule and for disabling, and an end-to-end test that `/privacy` opens signed out.

  They wait until the step in progress has merged, because they touch the same files.
- **Decision 2:** Step 16 merged before it (#42), so it now changes built code: SF01's and SO01's records and the keys in each import's diff become counts, and a migration drops the trainee numbers already stored. Step 17 is not built yet, so section 3's `enrollments` become section counts at no cost. Step 16's test that no name, mobile or grade column exists extends to trainee numbers. The demo's registrations (Step 16) and Step 43's demo enrollments, "by trainee number only", become counts too.
- **On acceptance, the plan gains notes for:**
  - Steps 10 and 11: merged, so the PR that implements this ADR changes their code, and each gets a note of what changed.
  - Steps 16 and 17: counts. Step 16 merged, so its note says what changed in its code.
  - Step 25: metadata; the upload line.
  - Steps 33, 36 and 38: their rows in the record.
  - Step 40: failed sign-ins; the network split.
  - Step 42: log and backup periods, written into the record.
  - Step 43: demo enrollments as counts.
  - Section 5: the auditor's check from decision 1.
  - Section 7: the go-live checklist.

  The request to the General Administration (`docs/ops/hosting-options.md`, item 3) drops the trainee rows.
- **People see:** the privacy link. Nothing else changes for them.
- **Risk:** the purges delete data. Their tests prove that they touch only the rows above and never a record of work.
- **Containment:** for a single account, `docs/ops/breach-response.md` uses Step 10's disabling and reset.
