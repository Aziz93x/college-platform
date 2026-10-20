---
description: UX and consistency review of the screens built in a range of steps
argument-hint: <from-to>, for example 11-20
---
1. From an up-to-date main, create branch review/ux-NN (NN: the last step of the range).
2. Use the ux-expert agent to review steps $ARGUMENTS.
3. Fix every screen scored under 4 and every consistency break.
4. Re-capture the screenshots; update visual baselines only for intended changes.
5. Open a PR titled "ux: steps $ARGUMENTS" with the report and the fixes; squash-merge it when CI is green.
