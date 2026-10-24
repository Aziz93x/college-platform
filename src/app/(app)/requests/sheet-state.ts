// What the request sheet opens on and says when a request is not sent, apart from its drawing so
// that tests read it (lead review D).

// The day the sheet opens on: the one the page reckons now, this week's due day or the next week's
// (lead review D, proposal 4), unless the sender picked one the request may still be due on. So
// neither midnight, a day off added since, nor another term on view leaves it on a day the server
// refuses.
export function openingDay(
  day: { min: string; max: string; off: readonly string[]; starts: string },
  kept: { dueOn: string; picked: boolean },
) {
  const allowed =
    day.min <= kept.dueOn &&
    kept.dueOn <= day.max &&
    !day.off.includes(kept.dueOn);
  return kept.picked && allowed ? kept.dueOn : day.starts;
}

// Why a request was not sent, when the answer is no refusal of the request's own: a field the
// action's schema refused, which the sheet's checks let through, or the action's refusal of the
// sender (signed out, forbidden), or an error. A refused field is not worth trying again as it is.
export function problemOf<Refusal extends string>(
  result: { validationErrors?: unknown; serverError?: Refusal } | undefined,
): { refusal: "invalid" } | { action: Refusal | "unexpected" } {
  if (result?.validationErrors) return { refusal: "invalid" };
  return { action: result?.serverError ?? "unexpected" };
}
