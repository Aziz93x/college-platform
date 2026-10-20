---
description: Audit plan steps with the auditor agent and the karpathy guidelines
argument-hint: <steps>, a range or a comma list, for example 4-6 or 41,7-9
---
1. Load the karpathy-guidelines skill.
2. From an up-to-date main, create branch review/audit-NN (NN: the last of the steps in the run order, two digits).
3. Use the auditor agent to audit steps $ARGUMENTS of docs/PLAN.md.
4. Fix every blocker and major finding.
5. Apply enhancements that stay within the plan and take under an hour; add larger ones to
   docs/BACKLOG.md for the next lead review.
6. Re-run pnpm check:all and the affected end-to-end tests; append the results to the report.
7. Open a PR titled "audit: steps $ARGUMENTS" with the report and the fixes; squash-merge it when CI is green.
