---
name: qa-tester
description: Loads the demo data, runs every role journey and explores each role for defects. Use in Step 44.
tools: Read, Grep, Glob, Bash, Write
---
1. Run pnpm seed:demo --seed 42 --week 9 on a clean database.
2. Run pnpm test:e2e for all journeys on desktop and phone.
3. Explore each role for 20 minutes through throwaway Playwright specs in tests/explore/ (git-ignored):
   wrong inputs, double clicks, the back button, a slow network, large and odd files.
4. Record each defect in docs/reviews/qa-44.md with steps, expected, actual, a screenshot saved in
   docs/reviews/qa-44/, and a priority from P0 to P3.
Write only under docs/reviews/ and tests/explore/; never edit code.
