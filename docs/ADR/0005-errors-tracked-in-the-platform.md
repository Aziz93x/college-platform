# ADR-0005: Errors tracked inside the platform, without a self-hosted GlitchTip

- Status: accepted (the owner chose it on 2026-10-20 to lower maintenance)
- Date: 2026-10-20
- Source: docs/PLAN.md section 2 (Monitoring), Step 42, Step 48 and the go-live checklist in section 7
- Supersedes: the GlitchTip part of the Monitoring row in ADR-0001

## Context

The plan used GlitchTip (self-hosted, Sentry-compatible) for errors. GlitchTip runs its own web, worker, PostgreSQL and Redis containers: one more service to update, back up and watch on a single small server, maintained by one person. The owner asked to lower the platform's maintenance.

A hosted error tracker would remove that work, but error reports can carry personal data, and section 8 keeps the data inside the Kingdom. So the errors stay in the platform's own database.

## Decision

No GlitchTip. Unhandled errors from the app (Next.js `onRequestError`) and from the worker are:

1. logged as structured pino error lines with their request id or job id, as today; and
2. recorded in an `error_events` table, grouped by a fingerprint of the error type and its top stack frame: first seen, last seen, count, and the latest request or job id. No request bodies, form values or other personal data are stored.

The admin's system-health screen lists them. A new fingerprint, or more errors in an hour than a threshold that is a setting, sends the admin an in-app notification. Retention is a setting. Step 42 builds this; Step 48 runs it on the server next to the external uptime check and the failed-backup alert.

## Consequences

- One service fewer to install, update, back up and secure.
- Errors stay in the Kingdom, inside the same database and its backups.
- Less than a full error tracker: no source-map viewer, release tracking or performance tracing. The request id in each error leads to the full log lines when more detail is needed.
- The go-live item "alerts for downtime, errors and failed backups reach the admin" is met by the uptime check, the error notification above and the failed-backup notification.
- A tracker can be added later behind the same `onRequestError` and worker hooks if error volume ever needs it.
