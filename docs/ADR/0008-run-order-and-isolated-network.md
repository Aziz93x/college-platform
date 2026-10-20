# ADR-0008: Run order, an isolated-network rule and the hosting-dependent channels

- Status: accepted (2026-10-20: the owner asked for the plan to be reordered where needed)
- Date: 2026-10-20
- Source: docs/PLAN.md (the run order in section 6, and the notes from ADR-0008 under the steps it changes); docs/ops/hosting-options.md
- Supersedes: the Oracle Cloud part of the Hosting row in ADR-0001; the passkeys and the Entra provider in its Sign-in row wait

## Context

Oracle Cloud refused the sign-up on 2026-10-20, so Section K, written for an Oracle Always Free VM, has no host. The General Administration chooses between the two options that `docs/ops/hosting-options.md` sets out for the approval request:

- A. A server inside the college on an isolated network. It sends no web push and no outbound email, takes its updates on approved media, needs an internal CA that phones trust, and phones reach it only on the college Wi-Fi.
- B. A cloud VM inside the Kingdom.

Microsoft 365 (Entra sign-in, SharePoint storage, Teams and Outlook) waits for the General Administration's approval, and it is unreachable from an isolated server. A passkey binds to a hostname and needs a certificate that phones trust, and neither is chosen.

Until the choice, the build stops after Step 46, and the production-like stack on the laptop (Step 41) is the only operational evidence for either option. In number order, Step 41 came after 35 more steps had been built on the production images, the proxy with Step 6's Secure cookies and origin checks, the app's database user and the worker's Chromium, none of them proven yet. Step 30's approval froze a portfolio snapshot that Step 31's curation would still change after Step 30's tests passed. The approval request also needs a demonstration of the core loop.

## Decision

1. Steps run in the order 1-6, 41, 7-29, 31, 30, 32-40, 42-46. Each keeps its number in branches, pull request titles and references, so the CHANGELOG, the earlier ADRs, the backlog, the review reports and code comments stay valid. Step 41 opens Section B, and Step 31 runs before Step 30, so approval freezes Step 31's real view, curation included.
2. Nothing is fetched from the internet at runtime: fonts, scripts, wasm, images and PDF assets ship in the images. From Step 41 on, a CI job starts the production images on a Docker network with no outbound route and runs the end-to-end smoke against Caddy, with the browser failing any request outside the app's origin, because the runner's browser still reaches the internet.
3. Alerts are in-app. The SMTP adapter, web push (VAPID), passkeys and the Entra provider wait for the hosting decision (docs/BACKLOG.md); Better Auth's provider seam stays.
4. A demonstration for the General Administration (the GA demonstration checkpoint) follows lead review F, on the saved `v0.6-F` images in demo mode, with a real phone. It holds up no step, and the written request goes out without waiting for it.
5. Section K is not built in this build: Audit 16 covers Step 46 alone, and Lead review K does not run. Once the General Administration chooses, Section K and the go-live checklist are rewritten for that option, and Audit 17 (Steps 47 and 48) and Lead review K run when it is built.
6. Step 2's arm64 requirement existed for Oracle's Ampere VM and waits for the hosting choice; multi-arch images stay the choice where they cost nothing.

docs/PLAN.md carries the details as notes from ADR-0008 under the steps they change.

## Consequences

- Step 41 grows from M to L and adds about 3 to 6 CI minutes to every pull request.
- Every later step keeps `docker/compose.yml` working: a step that adds an environment variable, a volume or a worker dependency updates it in the same pull request.
- `/audit` takes comma lists such as `41,7-9`, and a report is numbered by the last of its steps in the run order (`audit-09.md`).
- The owner has new checks: at Step 41, adding the new CI job to the required checks and, without holding up Step 7, a phone on the college Wi-Fi; at Step 26, a demo task on a real iPhone and on an Android phone.
- `docs/ops/hosting-options.md` states the personal data the platform keeps and what option A rules out, so the request can go out before the demonstration.
