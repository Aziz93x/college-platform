import { cookies } from "next/headers";
import { cache } from "react";
import {
  calendarOf,
  calendarSettings,
  findTerm,
  listTerms,
  weekOf,
} from "@/modules/terms";
import { TERM_COOKIE } from "./term-cookie.ts";

// The terms the viewer may look at, the latest first: the active and closed ones, and the drafts too
// for whoever manages the college's terms. Read once per request.
export const visibleTerms = cache(async (collegeId: string, manage: boolean) =>
  (await listTerms(collegeId)).filter(
    (term) => manage || term.status !== "draft",
  ),
);

// A term with where a day falls in it: its week, a week of holidays, or nothing outside it.
export const termOnDay = cache(
  async (collegeId: string, termId: string, day: string) => {
    const [term, settings] = await Promise.all([
      findTerm(collegeId, termId),
      calendarSettings(collegeId),
    ]);
    if (!term) return undefined;
    const week = weekOf(
      calendarOf(term, term.events, settings, term.breaks),
      day,
    );
    return { term, week };
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
