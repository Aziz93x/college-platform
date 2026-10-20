# ADR-0006: Renovate merges passing minor and patch updates itself

- Status: accepted (the owner chose it on 2026-10-20 to lower maintenance)
- Date: 2026-10-20
- Source: docs/PLAN.md section 2 (Quality gates: Renovate) and `renovate.json`

## Context

Renovate opens a pull request for each dependency update every week. Reviewing and merging minor and patch updates by hand is most of the routine maintenance, and the required CI checks on `main` already decide whether an update is safe: types, lint, unit and integration tests, the build, the end-to-end smoke test, the Docker images, CodeQL and gitleaks.

## Decision

`renovate.json` turns on automerge for:

- minor and patch updates of packages at version 1.0 or higher, grouped in one pull request a week;
- digest and pin updates (GitHub Actions commit SHAs, Docker image digests);
- lock file maintenance.

Major updates and packages below 1.0 stay manual: Renovate opens their pull requests and the owner, or a Claude Code session, reviews them. Node stays below 25 (`.nvmrc` pins Node 24).

Renovate merges only when every required check on the pull request passes. It uses GitHub's auto-merge where the repository allows it and otherwise merges on its next run.

## Consequences

- The owner sees only major updates and failures.
- A regression that the tests miss can reach `main` without a human look. The test suite and the required checks are the guard; such a merge is one revert away.
- Weekly grouping keeps the history readable and the CI cost to one run a week.
