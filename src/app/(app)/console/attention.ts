// How many terms still open have a failed pass as their latest, from the passes newest first: a
// later pass, done or waiting, already does what a failed one left (ADR-0029).
export function failedTerms(
  runs: readonly { termId: string; termStatus: string; status: string }[],
) {
  const latest = new Map<string, (typeof runs)[number]>();
  for (const run of runs) {
    if (!latest.has(run.termId)) latest.set(run.termId, run);
  }
  return [...latest.values()].filter(
    (run) => run.status === "failed" && run.termStatus !== "closed",
  ).length;
}
