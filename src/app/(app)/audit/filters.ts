import { searchCommands } from "@/components/motion/lib/command-search";
import type { AuditFilters } from "@/modules/audit";
import { nextDay, startOfDay } from "@/platform/i18n/time-zone";
import { toLatinDigits } from "@/platform/validation/digits";
import { collegePeople } from "./lookups.ts";
import type { AuditQuery } from "./query.ts";

// The address's filters as the log's reads take them: the period's days from the college's
// midnights, and the people the search finds by name, employee number or email.
export async function auditFilters(
  query: AuditQuery,
  collegeId: string,
  timeZone: string,
): Promise<AuditFilters> {
  const people =
    query.q === undefined
      ? undefined
      : searchCommands(
          (await collegePeople(collegeId)).map((person) => ({
            userId: person.userId,
            label: person.name,
            keywords: [person.employeeNumber, person.email],
          })),
          toLatinDigits(query.q),
        ).map((person) => person.userId);
  return {
    from: query.from ? startOfDay(query.from, timeZone) : undefined,
    to: query.to ? startOfDay(nextDay(query.to), timeZone) : undefined,
    action: query.action,
    people,
  };
}
