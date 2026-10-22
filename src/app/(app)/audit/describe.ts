import type { AuditEntry } from "@/modules/audit";

// What names the ids an event carries, and formats its values, on the page that shows it.
export type Lookups = {
  person: (userId: string) => string | undefined;
  department: (id: string) => string | undefined;
  // A role by its key, as memberships name it, or by its id, as its own events do.
  role: (key: string) => string | undefined;
  roleById: (id: string) => string | undefined;
  permission: (key: string) => string;
  setting: (key: string) => string | undefined;
  // A kind of notification a person turned off or on (Step 12).
  notificationKind: (kind: string) => string | undefined;
  // A term by its id, and a kind of day of its calendar (Step 13).
  term: (id: string) => string | undefined;
  calendarKind: (kind: string) => string | undefined;
  college: string;
  // A role's labels in the college's language.
  labels: (labels: Record<string, string>) => string;
  dateTime: (iso: string) => string;
  // A calendar day, YYYY-MM-DD.
  day: (day: string) => string;
  list: (items: string[]) => string;
};

// The words under audit.* in the catalog, and whether it has one.
export type Words = ((key: string) => string) & {
  has: (key: string) => boolean;
};

export type Change = { field: string; before?: string; after?: string };

export type EventView = {
  id: string;
  at: Date;
  actor: string;
  action: string;
  subject: string;
  changes: Change[];
  ip: string | null;
  device: string | null;
};

type Record_ = Record<string, unknown>;

const isRecord = (value: unknown): value is Record_ =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function format(
  field: string,
  value: unknown,
  lookups: Lookups,
  words: Words,
): string {
  if (value === null || value === undefined) {
    return field === "departmentId" ? words("college") : words("none");
  }
  if (typeof value === "boolean") return words(value ? "yes" : "no");
  if (typeof value === "string") {
    switch (field) {
      case "userId":
        return lookups.person(value) ?? words("unknownPerson");
      case "departmentId":
        return lookups.department(value) ?? value;
      case "role":
        return lookups.role(value) ?? value;
      case "lockedUntil":
        return lookups.dateTime(value);
      case "twoFactor":
        return words.has(`twoFactor.${value}`)
          ? words(`twoFactor.${value}`)
          : value;
      // A kind of notification, or of a day of a term's calendar: no name is both.
      case "kind":
        return (
          lookups.notificationKind(value) ??
          lookups.calendarKind(value) ??
          value
        );
      case "termId":
        return lookups.term(value) ?? value;
      case "startsOn":
      case "endsOn":
        return lookups.day(value);
      case "status":
        return words.has(`termStatus.${value}`)
          ? words(`termStatus.${value}`)
          : value;
      // The action an export was narrowed to.
      case "action":
        return words.has(`actions.${value}`)
          ? words(`actions.${value}`)
          : value;
      default:
        return value;
    }
  }
  if (Array.isArray(value)) {
    const items = value.map(String);
    return lookups.list(
      field === "permissions" ? items.map(lookups.permission) : items,
    );
  }
  if (isRecord(value) && field === "labels") {
    return lookups.labels(value as Record<string, string>);
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

// What changed: each field before and after; a setting's value as one; or what the event noted.
function changes(entry: AuditEntry, lookups: Lookups, words: Words) {
  const diff = entry.diff;
  if (!diff) return [];
  const label = (field: string) =>
    words.has(`fields.${field}`) ? words(`fields.${field}`) : field;
  const row = (field: string, before: unknown, after: unknown): Change => ({
    field: label(field),
    before:
      before === undefined ? undefined : format(field, before, lookups, words),
    after:
      after === undefined ? undefined : format(field, after, lookups, words),
  });
  if (!("from" in diff || "to" in diff)) {
    return Object.entries(diff).map(([field, value]) => ({
      field: label(field),
      after: format(field, value, lookups, words),
    }));
  }
  const { from, to } = diff;
  if (entry.entityType === "setting" || !(isRecord(from) || isRecord(to))) {
    return [row("value", from, to)];
  }
  const before = isRecord(from) ? from : {};
  const after = isRecord(to) ? to : {};
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter(
      (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]),
    )
    .map((field) => row(field, before[field], after[field]));
}

// Who or what the event is about, by name.
function subject(entry: AuditEntry, lookups: Lookups, words: Words) {
  const id = entry.entityId;
  switch (entry.entityType) {
    case "user":
      return lookups.person(id) ?? words("unknownPerson");
    case "department":
      return lookups.department(id) ?? id;
    case "role":
      return lookups.roleById(id) ?? id;
    case "setting":
      return lookups.setting(id) ?? id;
    case "college":
      return lookups.college;
    case "term":
      return lookups.term(id) ?? id;
    // A year's Eid break by its name and Hijri year, as it was adjusted (ADR-0018).
    case "holiday": {
      const diff = entry.diff ?? {};
      const was = isRecord(diff.to) ? diff.to : diff.from;
      return isRecord(was) && typeof was.name === "string"
        ? `${was.name} ${was.hijriYear}`
        : id;
    }
    // An announcement by its title, as it was published or withdrawn (ADR-0017).
    case "announcement": {
      const diff = entry.diff ?? {};
      const said =
        isRecord(diff.to) && "title" in diff.to ? diff.to : diff.from;
      return isRecord(said) && typeof said.title === "string" ? said.title : id;
    }
    case "membership": {
      const diff = entry.diff ?? {};
      const held = (isRecord(diff.to) ? diff.to : diff.from) as
        | Record_
        | undefined;
      if (!held) return id;
      return `${format("userId", held.userId, lookups, words)}: ${format(
        "role",
        held.role,
        lookups,
        words,
      )} · ${format("departmentId", held.departmentId, lookups, words)}`;
    }
    default:
      return id;
  }
}

export function describeEvent(
  entry: AuditEntry,
  lookups: Lookups,
  words: Words,
): EventView {
  return {
    id: entry.id,
    at: entry.createdAt,
    actor:
      entry.actorId === null
        ? words("system")
        : (lookups.person(entry.actorId) ?? words("unknownPerson")),
    action: words(`actions.${entry.action}`),
    subject: subject(entry, lookups, words),
    changes: changes(entry, lookups, words),
    ip: entry.ip,
    device: entry.userAgent,
  };
}
