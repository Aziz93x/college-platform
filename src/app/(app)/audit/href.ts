import type { AuditCursor } from "@/modules/audit";
import type { AuditQuery } from "./query.ts";

// The address of the log with these filters, starting after a cursor. Kept apart from query.ts,
// whose action list comes from the audit module's server code, so the filters' client code can
// build it too.
export function auditHref(base: string, filters: AuditQuery) {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.action) params.set("action", filters.action);
  if (filters.q) params.set("q", filters.q);
  if (filters.after) {
    params.set("after", `${filters.after.at}|${filters.after.id}`);
  }
  const search = params.toString();
  return search ? `${base}?${search}` : base;
}

// A record's page with its history panel starting after a cursor, scrolled to the panel.
export function historyHref(base: string, after?: AuditCursor) {
  const search = after
    ? `?${new URLSearchParams({ history: `${after.at}|${after.id}` })}`
    : "";
  return `${base}${search}#history`;
}
