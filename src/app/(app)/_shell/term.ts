import { cookies } from "next/headers";
import { cache } from "react";
import { authorize, permittedDepartments } from "@/modules/access";
import {
  calendarOf,
  calendarSettings,
  findTerm,
  listTerms,
  weekOf,
} from "@/modules/terms";
import { TERM_COOKIE } from "./term-cookie.ts";

// Whoever prepares a term before it starts sees it while it is a draft: the vice-dean, who manages
// the college's terms, and whoever edits a department's plan, whose plan for the next term the
// wizard copies there (Step 19).
export function preparesTerms(viewer: Parameters<typeof authorize>[0]) {
  const plans = permittedDepartments(viewer, "plan.edit");
  return (
    authorize(viewer, "term.manage", { collegeId: viewer.collegeId }) ||
    plans === "college" ||
    plans.length > 0
  );
}

// The terms the viewer may look at, the latest first: the active and closed ones, and the drafts too
// for whoever prepares them (preparesTerms()). Read once per request.
export const visibleTerms = cache(async (collegeId: string, manage: boolean) =>
  (await listTerms(collegeId)).filter(
    (term) => manage || term.status !== "draft",
  ),
);

// A term with its calendar, its weeks counted by the college's calendar settings. Read once per
// request: the header and the page that shows the term share it.
export const termCalendar = cache(async (collegeId: string, termId: string) => {
  const [term, settings] = await Promise.all([
    findTerm(collegeId, termId),
    calendarSettings(collegeId),
  ]);
  if (!term) return undefined;
  return {
    term,
    settings,
    calendar: calendarOf(term, term.events, settings, term.breaks),
  };
});

// A term with where a day falls in it: its week, a week of holidays, or nothing outside it.
export const termOnDay = cache(
  async (collegeId: string, termId: string, day: string) => {
    const found = await termCalendar(collegeId, termId);
    if (!found) return undefined;
    return { term: found.term, week: weekOf(found.calendar, day) };
  },
);

// The term the header shows: the one the viewer chose, while they may still see it, or else the
// college's active term.
export async function viewedTerm(collegeId: string, manage: boolean) {
  const [terms, store] = await Promise.all([
    visibleTerms(collegeId, manage),
    cookies(),
  ]);
  const chosen = store.get(TERM_COOKIE)?.value;
  return {
    terms,
    term:
      terms.find((term) => term.id === chosen) ??
      terms.find((term) => term.status === "active"),
  };
}
