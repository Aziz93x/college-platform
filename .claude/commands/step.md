---
description: Execute or resume one step of docs/PLAN.md
argument-hint: <step number>
---
Read CLAUDE.md and docs/PLAN.md. Work on Step $ARGUMENTS only. NN below is the step number in two digits.
1. If a branch step/NN-* exists, check it out and continue from the unchecked items in its PR checklist.
   Otherwise create step/NN-<slug> from an up-to-date main.
2. Before coding, state your assumptions and a short plan as "step -> verify" lines.
   If anything is unclear or conflicts with the code, stop and ask.
3. Items marked "You:" belong to the owner: stop there, hand over a short checklist, and continue when told.
4. Work until every "Done when" check passes and pnpm check:all is green; extend pnpm seed:demo.
5. Open or update the PR with the checklist; its title ends with (step NN). Summarize what changed and the
   commands that proved it. When CI is green, squash-merge it.
