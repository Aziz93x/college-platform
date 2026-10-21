import { z } from "zod";
import { type AuditCursor, auditActions } from "@/modules/audit";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
// Where a page of events starts: the last one shown before it, by its time to the microsecond and id.
const cursor = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2} [\d:.]+[+-]\d{2}(:\d{2})?\|[0-9a-f-]{36}$/)
  .transform((value): AuditCursor => {
    const [at, id] = value.split("|");
    return { at, id };
  });

// The log's address: a period of calendar days, an action, a person searched for, and where the page
// starts. Anything that does not parse is left out, so a hand-edited address still shows the log.
const query = z.object({
  from: day.optional().catch(undefined),
  to: day.optional().catch(undefined),
  action: z.enum(auditActions).optional().catch(undefined),
  q: z.string().trim().max(200).optional().catch(undefined),
  after: cursor.optional().catch(undefined),
});

export type AuditQuery = {
  from?: string;
  to?: string;
  action?: (typeof auditActions)[number];
  q?: string;
  after?: AuditCursor;
};

export function parseAuditQuery(
  params: Record<string, string | string[] | undefined>,
): AuditQuery {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const parsed = query.parse(
    Object.fromEntries(
      ["from", "to", "action", "q", "after"].map((key) => [
        key,
        first(params[key]),
      ]),
    ),
  );
  return {
    from: parsed.from,
    // A period has its start, and its end is not before it, as the picker chooses one.
    to:
      parsed.from && parsed.to && parsed.to >= parsed.from
        ? parsed.to
        : undefined,
    action: parsed.action,
    q: parsed.q || undefined,
    after: parsed.after,
  };
}

// The cursor a history panel's address carries, if it parses.
export function parseCursor(value: string | string[] | undefined) {
  const parsed = cursor.safeParse(Array.isArray(value) ? value[0] : value);
  return parsed.success ? parsed.data : undefined;
}
