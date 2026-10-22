# Data protection: the platform's record of personal data

- Status: draft, for the controller and its data protection officer to confirm
- Date: 2026-10-21, updated on 2026-10-22 for Steps 10 to 15, ADR-0014 and ADR-0017 as merged (#21 to #24, #29, #30, #32, #35 and #36)
- Decisions: ADR-0013 (proposed)
- Related: `docs/privacy/privacy-notice.md` (the notice, in Arabic), `docs/ops/breach-response.md` (the incident runbook, in Arabic), `docs/ops/hosting-options.md` (the request to the General Administration)

This is the platform's record of the personal data it keeps: what, about whom, why, for how long, who sees it, and which rule asks for what. The project wrote it, not a lawyer. Each item marked **to confirm** belongs to the controller and its data protection officer (DPO), and nothing here is legal advice.

Until the General Administration approves the hosting and this record, the platform holds demo data only. Testers use demo accounts and photograph printed demo copies, never real papers or their own records (docs/PLAN.md, Step 46, note from ADR-0008).

Every step that stores a new kind of personal data adds its row to the inventory and the retention schedule in the same pull request (ADR-0013, decision 1).

## Who is who

| Role | Who | To confirm |
| --- | --- | --- |
| Controller (جهة التحكم) | The public entity the college belongs to, the Technical and Vocational Training Corporation, acting through the college. It decides why and how the data is processed. | The legal name, and who signs for it. The request to the General Administration (item 2) names the data owner. |
| Data protection officer | Not named yet. SDAIA's DPO rules (31 August 2024) require one where a public entity's services involve large-scale processing. The draft amendments of October 2026 would require one in every public entity. | Who, and the contact published on `/privacy`. |
| Processor | Whoever runs the platform for the controller: the college's IT on its own server (option A), or a cloud provider inside the Kingdom (option B). During the build, the developer, with demo data only. | A written processing agreement before real data arrives. |
| Data subjects | Staff who sign in: trainers, heads, secretaries, the vice-dean, the dean, quality reviewers and admins. Trainees, who never sign in: their data arrives from Rayat and may appear in evidence photos. | |
| Regulators | SDAIA, the competent authority under the PDPL: breach notices and the national register of controllers. The NCA: cybersecurity controls and incident reports. The NDMO, under SDAIA: data management, classification and where data may be stored. | |

## The rules that apply

### The Personal Data Protection Law (PDPL) and its Implementing Regulations

The law was issued by Royal Decree M/19 (1443H) and amended by Royal Decree M/148 (1444H). It has been in force since 14 September 2023, and its grace period ended in September 2024.

| What it asks | Where | How this platform answers |
| --- | --- | --- |
| Collect only what the purpose needs | PDPL Art. 11 | The inventory below. From Rayat, trainee names, mobile numbers and grades are dropped while parsing (Step 16). ADR-0013 proposes storing no trainee number at all. |
| A privacy policy available before collection | PDPL Art. 12 | `/privacy`, open without signing in and linked from the sign-in page. Draft text: `docs/privacy/privacy-notice.md`. |
| Inform people when collecting from them | PDPL Art. 13 | The same page, plus a line on the sign-in card. |
| Inform people whose data came from another source, within 30 days | Implementing Regulations | Trainees, through Rayat. **To confirm:** how the college tells them (its website, the trainee guide, Rayat's notices). |
| A legal basis for each purpose | PDPL Arts. 5, 6 and 10 | **To confirm.** Proposed: for staff, Art. 6(2), processing under another law or a prior agreement the person is party to (their employment). For the data taken from Rayat, Art. 10(3): a public entity whose collection is required for the public interest or by another law. Not consent: an employee cannot refuse freely, and the platform never asks for consent. |
| Rights: be informed, access, a copy in a readable format, correction, destruction | PDPL Art. 4; Implementing Regulations Arts. 5 and 6 | The rights process below. |
| Answer a request within 30 days, extendable once with notice | Implementing Regulations Art. 3 | The rights process below. |
| Destroy the data when its purpose ends, including every copy and backup | PDPL Art. 18; Implementing Regulations Art. 8 | The retention schedule below. Backups count, so the backup period bounds every deletion. |
| Security proportionate to the data | PDPL Art. 19 | The NCA controls below. |
| Report a breach to SDAIA within 72 hours of becoming aware, through the National Data Governance Platform, and keep a copy of the report. Tell the people affected without undue delay when harm is likely. Keep a record of breaches. | PDPL Art. 20; Implementing Regulations Art. 24; SDAIA's breach guide | `docs/ops/breach-response.md`. **To confirm:** the runbook proposes notifying SDAIA of every incident that touches personal data, as the October 2026 draft would require, and not only when harm is likely. |
| An impact assessment before risky processing | PDPL Art. 22; Implementing Regulations Art. 25 | The assessment section below: required here. |
| A record of processing, kept during the processing and 5 years after it ends | PDPL Art. 31; Implementing Regulations | This document is its source. |
| Transfers outside the Kingdom only under the law's conditions | PDPL Art. 29 | None. The platform runs inside the Kingdom (docs/PLAN.md, section 8 and the go-live checklist in section 7; ADR-0005) and fetches nothing from outside. |

Penalties:
- Up to SAR 5 million per violation, doubled for a repeat (PDPL Art. 36).
- Disclosing sensitive data to harm someone or for gain: up to two years in prison and SAR 3 million (PDPL Art. 35).
- People harmed can also claim compensation (PDPL Art. 40).

### Draft amendments to the Implementing Regulations

SDAIA's draft is in public consultation until 5 November 2026. If adopted, it takes effect 60 days after publication. Where it costs little, the platform follows the stricter draft already:
- A DPO in every public entity.
- Registration in the national register of controllers, mandatory for public entities.
- Notice to SDAIA within 72 hours even when harm is unlikely.
- Personal data stored inside the Kingdom.
- Privacy notices in clear, simple language, in Arabic for these users.
- An impact assessment whenever minors' data is processed.

### NCA Essential Cybersecurity Controls (ECC-2:2024)

They bind government entities, so the college's systems. The controls that touch this platform, with their numbers in ECC-2:2024:

| Control | Asks | Platform today | Gap, and where it closes |
| --- | --- | --- | --- |
| 2-2-3-2 | Multi-factor authentication for remote access and privileged accounts, based on an assessment of the impact of authentication failure and bypass | Two-factor is the college's choice: `auth.requireTwoFactor`, off by default (ADR-0014). While it is on, whoever holds a key that requires it sets up TOTP first, and the system role holds them all (ADR-0009). Anyone may turn it on for their own account. | Turn the setting on before real data arrives, or record the owner's written choice (the go-live checklist, ADR-0014). Write the authentication impact assessment. Remote administration of the server waits for the hosting decision (Section K of the plan). |
| 2-2-3-5 | Periodic review of identities and access rights | The roles grid; every membership change is audited (Step 9) and shows in Step 11's audit screen and each record's history | No prompt to review: ADR-0013 adds a list of the memberships no admin has confirmed within a set period |
| 2-7-2 | Protect data by its classification | Department scopes; no trainee names stored; trainee data shown as counts only (Step 34); exam copies hidden until the exam date (Step 30) | The classification itself, for the data owner (below) |
| 2-8-3-3 | Encrypt data in transit and at rest, by classification | HTTPS everywhere through Caddy, HSTS on the real host (Step 47); two-factor secrets encrypted with `AUTH_SECRET` | The database, files and the current dump are not encrypted at rest: disk encryption on the server (option A) or the provider's (option B); encrypted backups in Step 42 |
| 2-9-3-3 | Test backup recovery periodically | Not yet | Step 42's timed restore drill, and a drill before each exam week (section 8 of the plan) |
| 2-12-3-5 | Keep cybersecurity event logs at least 12 months | Audit events are append-only. Step 11's daily job deletes a college's events older than `audit.retentionMonths` (60 months by default), and the database refuses to keep less than 12 (migration 0010) | A failed sign-in leaves a durable record only when it locks an existing account (`account.lock`). Container logs are not rotated and are lost when a container is recreated, and Caddy writes no access log. (Steps 40 and 42; ADR-0013, decision 7) |
| 2-13-3-3 | Report cybersecurity incidents to the NCA | | `docs/ops/breach-response.md`, within the corporation's own procedure and deadline |
| 2-15-3-1 | A web application firewall | None, and none is planned | Decide with the hosting: the provider's on option B, the college's network on option A |
| 2-15-3-2 | A multi-tier architecture | Only Caddy publishes ports, and CI proves it. But Caddy, the app, the worker and PostgreSQL share one internal network, so the web tier can reach the database. | Split the networks so that Caddy reaches only the app (Step 40) |
| 2-15-3-3 | Secure protocols such as HTTPS | HTTPS only; the session cookie is `Secure` everywhere | |
| 2-15-3-5 | For external web applications: the authentication factors set by an assessment of the impact of authentication failure and bypass | Staff sign in with a password; TOTP when the college requires it for their keys, or when they turn it on themselves (ADR-0014) | The same impact assessment as 2-2-3-2. Revisit for option B, where the platform is reachable from the internet. |

The NCA's Data Cybersecurity Controls (DCC-1:2022), the data extension of ECC, also bind government entities. The DPO maps them against the classification below.

ECC-1:2018 had a control requiring hosting inside the Kingdom (4-2-3-3). ECC-2:2024 deleted it and referred data matters to the NDMO. The platform's own rule stands: it runs inside the Kingdom (docs/PLAN.md, section 8; ADR-0005), now resting on the NDMO's rules and the PDPL draft.

### NDMO: classification and data management

- **Levels:** سري للغاية، سري، مقيد، عام. In English, Top Secret (or Highly Confidential), Secret (or Confidential), Restricted and Public.
- **Default:** the NDMO-based policies of Saudi universities treat data not classified yet as Restricted until it is. Another agency's NDMO-based policy treats it as Top Secret. **To confirm** with the corporation's data management office.
- **Standards:** the NDMO's Data Management and Personal Data Protection Standards have 15 domains, among them Data Classification, Personal Data Protection, and Data Security and Protection.

## What the platform keeps

### Today (Steps 1 to 15)

| Data | About | Where | Why | Who sees it |
| --- | --- | --- | --- | --- |
| Name, email (lowercase), two-factor flag, "must change password" flag, when the account was disabled (Step 10) | Staff | `users` | The account | The person; admins |
| Employee number, college | Staff | `people` | Signing in by employee number; matching Rayat's sections to trainers (Step 17) | The person; admins; heads in their department |
| Password hash. A temporary password, for a new account or after a reset, is shown once to hand over and never kept in clear (Step 10). | Staff | `accounts` | Checking the password | Nobody: one-way |
| TOTP secret and backup codes, encrypted with `AUTH_SECRET`. Turning two-factor off deletes both (ADR-0014). | Staff who turned it on, and, while `auth.requireTwoFactor` is on, whoever holds a key that requires it | `two_factors` | Two-factor sign-in | Nobody: encrypted |
| Session token, IP address, user agent, remembered, last seen, when the password was last typed | Staff | `sessions` | Keeping someone signed in; idle timeout; re-authentication | Nobody in the interface |
| Short-lived verification values | Staff | `verifications` | Better Auth's internals; it deletes expired ones the next time anyone checks a two-factor code | Nobody |
| The identifier as typed, with the address, and a count | Anyone who tries to sign in, with or without an account | `sign_in_attempts` | Limits per identifier and address | Nobody |
| The identifier as typed, and a count | Same | `sign_in_lockouts` | Lockout | Nobody |
| Who holds which role, across the college or in a department, and for one term or with no end (Step 13) | Staff | `memberships` | Authorization | Holders of `roles.manage` |
| Who did what to which record, its changes, IP address and user agent | Staff | `audit_events` | Accountability and security investigation | Holders of `audit.view`: the system role by default. The key requires two-factor while `auth.requireTwoFactor` is on (ADR-0014). Step 11's audit screen shows the IP address and the device, and its CSV export writes them out; each export is itself audited (`audit.export`). The history under each record shows its events without them. |
| A people file: employee number, name, email, department and role on each row | Staff | Not stored. Read in memory for the preview, then its rows are sent back for the import (Step 10). | Creating accounts and memberships | The admin who imports it |
| What a person was told: the kind, its details (a role and its department, the week's unread count and the newest notifications, or an announcement), and when it was sent and read | Staff | `notifications` (Step 12) | Telling people what changed for them, in the platform only | The person. For an announcement, its author and the holders of `announcements.publish` across the college see how many of those it reached have read it, never who (ADR-0017). |
| Which kinds each person receives | Staff | `notification_prefs` (Step 12) | The same | The person |
| What a head, the dean or the vice-dean announced: a title and a short text, its author, the department or the whole college it went to, and when it was published and withdrawn | Staff: the author, and anyone the text names | `announcements` (ADR-0017) | Telling a department or the college something at once | Everyone it reached, as a notification until it is withdrawn. On `/announcements`, while it is live, whoever announces to its scope. A withdrawn one keeps its row, which no screen shows. |
| Who endorsed the draft of a term's general framework, who published each version, and when. A change to the draft's items clears its endorsement. | Staff: the dean and the vice-dean as seeded (`framework.endorse`, `framework.publish`) | `frameworks` (Step 15) | Accountability for the version every department's plan inherits | No screen names them. Everyone in the college reads the published version and its date; whoever prepares or endorses the draft sees that it is endorsed. The audit events of both name the person. |

Colleges, departments, roles, settings, terms, their calendars and the Eid breaks (Step 13, ADR-0018), the portfolio axes (Step 14) and the framework's items (Step 15) hold no personal data. Their audit events name whoever changed them.

### Planned

Each step updates its row when it is built. The data is listed here now so the classification and the impact assessment cover it before it exists.

| Data | About | Step | Notes |
| --- | --- | --- | --- |
| Trainee number, registration status and trainee status per section (SF01) | Trainees | 16, 17 | Names, mobile numbers and grades are dropped while parsing. ADR-0013 proposes per-section counts instead of trainee numbers. |
| Trainee number, course status such as barred for absence, unexcused absence in percent and hours (SO01, optional) | Trainees | 16 | Same proposal: per-course counts and bands |
| Evidence: photos and files from trainers' phones | Trainers, and trainees who appear in them | 25 | May show a trainee's face, name or grade, as on a homework sample or a grade sheet. The browser removes location; ADR-0013 removes all metadata. |
| The upload queue in each trainer's browser (IndexedDB) | Same | 25 | Photos wait on the phone until they upload; the queue empties as each one does |
| Professional profile: qualifications, experience, development, goals | Trainers | 28 | |
| Reviews, returns, approvals, portfolios and their PDFs | Trainers | 29 to 33 | An evaluation of each employee's work |
| The download log of department portfolios, and the viewer's name in each PDF's watermark | Staff | 33 | |
| Indicators | Trainers; trainees as counts | 34 to 36 | No trainee names; trainer names only for heads and the vice-dean; the dean sees totals |
| A per-person log of events with their durations, for the pilot measurement | Staff | 36 | The clearest case of monitoring for the impact assessment |
| Meetings, attendees, minutes and decisions | Staff | 37 | |
| The department's contact directory | Staff | 38 | |
| Error reports | Whoever was signed in | 42 | `error_events` keeps no request bodies, form values or other personal data (ADR-0005). The log lines its request id points to can carry an address. |
| Logs and backups | Everyone above | 42 | |
| The job queue's tables (pg-boss) | Whoever a job's payload names | 3 onward | Only the heartbeat today, which names nobody. A step that adds a job naming a person states how long its finished jobs stay. |

**Sensitive data** in the PDPL's sense is not collected by design. That covers health, beliefs, origin, security and criminal data, biometric and genetic data, and data on unknown parentage. Absence arrives as unexcused absence only, never with its excuse, so no medical note enters the platform. Photos of people are personal data, but not biometric data: nothing recognizes faces.

## Classification (proposed, for the data owner)

This is item 3 of the request to the General Administration.

| Level | What | Why |
| --- | --- | --- |
| Secret (سري) | Exam copies before their exam date; password hashes, two-factor secrets, session tokens, `AUTH_SECRET` and the database passwords | Disclosure would break an exam or let someone act as another person |
| Restricted (مقيد) | Everything else in the database, the evidence files, the logs and the backups | The data identifies people. The default for unclassified data is to confirm (above). |
| Public (عام) | Nothing | Pages carry `noindex` (Step 47), and the public pages hold no data |

## Retention schedule (proposed)

The schedule follows a few rules:
- A row's period starts when its purpose ends.
- A deletion is complete only once the backups that held the data have expired (Implementing Regulations Art. 8).
- Records of the college's work follow its records schedule for training records. Nothing is deleted from them automatically until the controller gives that schedule.

| Data | Kept for | How it goes | State |
| --- | --- | --- | --- |
| Sessions | Until their limit: 12 hours, 30 days on a remembered device, 60 minutes idle (the `auth.*` settings), 90 days at most | Deleted when next seen past it. A daily job deletes the ones never seen again. | Job: ADR-0013. Today they stay, with their IP address and user agent. |
| Verification values | Until they expire | Better Auth deletes them at the next two-factor code check; the daily job is a backstop | Job: ADR-0013 |
| Sign-in counts | 15 minutes by default (`auth.signInWindowMinutes`, `auth.lockoutMinutes`) | Pruned by the next attempt, and by the daily job | The typed identifier and the address become keyed hashes (ADR-0013) |
| IP address and user agent in audit events | Proposed: 12 months, the ECC-2:2024 minimum (2-12-3-5). Today they stay as long as their event. | A second owner function, next to Step 11's `purge_audit_events()`, clears both columns and keeps the event | Setting `privacy.auditNetworkMonths` (12, never less): ADR-0013 |
| The rest of each audit event | `audit.retentionMonths`: 60 months by default, from 12 to 120, changed by an admin after re-authentication | Step 11's daily job deletes them as the table owner (`purge_audit_events()`, migration 0010) | Step 11. **To confirm:** the records schedule may keep the events about training records longer. |
| Notifications | Proposed: 12 months after they were sent | The daily job | Job and setting `privacy.notificationMonths` (12): ADR-0013. Today they stay. |
| Announcements | Proposed: 12 months after they were published, withdrawn or not, like their notifications. Their audit events keep who announced to which scope, and when. | The daily job | The same job and setting: ADR-0013. Today they stay, withdrawn ones too. |
| Error reports | 90 days | Step 42's job | Step 42 |
| Logs | Security events 12 months, the rest 30 days | Rotation | Step 42 |
| Backups | About 15 days today: a daily dump on the same server, and each day's run deletes the dumps more than 14 full days old | Rotation, which bounds every deletion above | Deployment configuration, not a setting. Step 42 replaces it with encrypted backups and states its periods here. |
| Rayat files and people files | Never stored | Read in memory and discarded | People files: Step 10, as built. Rayat files: Step 16. |
| Trainee rows from SF01 and SO01 | None, if counts replace them (ADR-0013). Otherwise until the term closes, plus one term. | | Step 16 |
| A staff member who leaves | Sign-in ends the day they leave. The name and employee number stay with their records. | Step 10 disables the account and deletes its sessions. ADR-0013 adds the password hash and the two-factor secrets. | Step 10; ADR-0013 |
| Each term's frameworks with who endorsed and published them (Step 15); evidence, reviews, approvals, portfolios, indicators and minutes | The college's records schedule for training records | | **To confirm** with the corporation's records office |

## People's rights

1. **Where to ask:** the DPO, whose contact is on `/privacy`. Staff can also ask an admin.
2. **Identity:** a staff member through their account; a trainee through the college's usual check, as for Rayat.
3. **Record and answer:** every request is recorded with its date, and answered within 30 days. Once, the period can extend by 30 more days, with notice.
4. **What the platform can produce:**
   - **Staff:** whatever exists of their profile, tasks, evidence, reviews, portfolio PDFs (Step 32) and the audit events about them.
   - **Trainees:** the rows under their trainee number, if any are kept.
   - **Limit:** photos cannot be searched by face. Finding a trainee in evidence means a manual search of their sections' evidence by the trainer or the head.
5. **Correction:**
   - Staff details: an admin (Step 10).
   - Rayat data: corrected in Rayat, the system of record, then imported again.
6. **Destruction:** done when no retention rule applies (PDPL Art. 18). Otherwise the answer says which rule keeps the data, and until when.
7. **Missing:** a "this person's data" export for admins. Today Step 11's audit screen filters the events by person and exports them as CSV. ADR-0013 adds the profile and memberships to that export, and each later step adds its records.

## Impact assessment

**Required.** The platform links datasets from different sources: Rayat's SS01, SF01 and SO01, joined to its own tasks and evidence. Linking datasets is one of the cases the Implementing Regulations name (Art. 25).

Three more reasons make the assessment worth doing well:
- **Regular evaluation of employees:** reviews, portfolios and indicators, and Step 36's per-person log of events with their durations. This is close to the regulations' case of systematic monitoring.
- **Photos that may show trainees.**
- **Possibly minors:** the October 2026 draft makes minors' data a case of its own.

- **When:** before the first real Rayat import and before the first real evidence, so before go-live.
- **Who:** the controller with its DPO. The project supplies this record, the data flow (Rayat to import to counts; phone to evidence to review to portfolio) and the controls above.

## The public repository

The repository is public (ADR-0004), so it never holds real data:
- no Rayat file or people import file
- no export or report
- no screenshot of a real screen
- no database dump, log, error report, backup or incident file

The demo data is synthetic, uses `.example` addresses and carries a visible watermark. Rayat fixtures are headers only (Step 16).

What guards it:
- **gitleaks** scans every push, but for secrets only: it does not recognize personal data. That rule rests on people.
- **The ignore files** keep database dumps and incident folders out of git and out of the Docker build context.

On 21 October 2026, the tree held no real phone or national ID number, and no real email address outside the package metadata in `pnpm-lock.yaml`. The procurement details in `docs/ops/hosting-options.md`, such as prices and the request itself, are the college's information rather than personal data. The owner decides whether they stay public.

## For the controller and the DPO

- [ ] Name the controller's representative, and appoint or name the DPO.
- [ ] Confirm the legal basis for each purpose (proposed: PDPL Art. 6(2) for staff, Art. 10(3) for Rayat data).
- [ ] Approve the classification above (item 3 of the request to the General Administration), and confirm the default for unclassified data with the corporation's data management office.
- [ ] Approve the retention schedule, and give the records schedule for training records.
- [ ] Decide how trainees are told, within 30 days of each import.
- [ ] Decide whether SDAIA is notified of every incident or only when harm is likely.
- [ ] Turn on `auth.requireTwoFactor` before real data arrives, as ECC-2:2024 2-2-3-2 asks for privileged accounts, or record the owner's written choice (ADR-0014).
- [ ] Carry out the impact assessment, and the authentication impact assessment for ECC-2:2024 2-2-3-2 and 2-15-3-5, before go-live.
- [ ] Map the NCA's Data Cybersecurity Controls (DCC-1:2022) against the classification.
- [ ] Register in the national register of controllers if required (mandatory for public entities in the draft amendments).
- [ ] Sign a processing agreement with whoever hosts the platform.
- [ ] Approve the privacy notice (`docs/privacy/privacy-notice.md`). The dean's circular for the trial (section 7 of the plan) carries its summary.
- [ ] Rehearse `docs/ops/breach-response.md` once before go-live, as a table-top exercise.

ADR-0013 itself is the owner's to decide; the DPO reviews it.

## Sources

- NCA, [Essential Cybersecurity Controls ECC-2:2024](https://cdn.nca.gov.sa/api/files/public/upload/86e09090-44e4-481f-bc28-355673607654_ECC--2024-EN.pdf), [its page](https://nca.gov.sa/en/regulatory-documents/controls-list/ecc) and [the Data Cybersecurity Controls](https://nca.gov.sa/en/regulatory-documents/controls-list/dcc/)
- [Personal Data Protection Law](https://qanoniah.com/en/File/p2k3ZM8gW5oZR29oRDEebGwYj), and [its Implementing Regulation](https://qanoniah.com/en/File/5MO1KpeND47mMv97VbAa2dZxE-Implementing-Regulation-of-the-Personal-Data-Protection-Law)
- [Rules for Appointing a Personal Data Protection Officer](https://qanoniah.com/en/File/X02Olv9Ben0bm6bL4VkEwqNpA-Rules-for-Appointing-a-Personal-Data-Protection-Officer)
- Baker McKenzie, [Saudi Arabia publishes guidance on data breach notification](https://connectontech.bakermckenzie.com/saudi-arabia-publishes-guidance-on-data-breach-notification/), and [the end of the grace period](https://me-insights.bakermckenzie.com/2024/05/17/saudi-arabia-next-steps-for-compliance-with-personal-data-protection-law-as-one-hijri-year-grace-period-expiry-approaches)
- Clyde & Co, [SDAIA publishes draft amendments to the Implementing Regulations of the PDPL](https://www.clydeco.com/en/insights/2026/10/sdaia-publishes-draft-amendments-to-the-pdpl) (October 2026)
- Latham & Watkins, [Saudi Arabia's data protection law enters into force](https://www.lw.com/en/insights/2023/12/Saudi-Arabias-data-protection-law-enters-into-force)
- Securiti, [Saudi Arabia Personal Data Protection Law](https://securiti.ai/saudi-arabia-personal-data-protection-law)
- NDMO-based data classification policies: [Taif University](https://tu.edu.sa/En/Data-Management-Office/376/Pages/23506/Data-Classification-Policy), [King Saud University](https://dmo.ksu.edu.sa/sites/dmo.ksu.edu.sa/files/2025-09/DataClassificationPolicy.pdf), and [the General Authority for Military Industries](https://www.gami.gov.sa/sites/default/files/2026-01/%D8%B3%D9%8A%D8%A7%D8%B3%D8%A9%20%D8%AA%D8%B5%D9%86%D9%8A%D9%81%20%D8%A7%D9%84%D8%A8%D9%8A%D8%A7%D9%86%D8%A7%D8%AA.pdf)
- Saudipedia, [National Data Management Office](https://saudipedia.com/en/national-data-management-office-ndmo); Kiteworks, [Guide to Saudi Arabia's NDMO standards](https://www.kiteworks.com/sites/default/files/resources/kiteworks-guide-to-saudi-arabia-ndmo-standards.pdf)
