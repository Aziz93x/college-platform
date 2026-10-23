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
  // An item of the framework or of a department's plan as their pages word it (Steps 15 and 19):
  // its axis, kind, reach, due rule and evidence as its events recorded them, or nothing for what
  // they cannot read (UX review 2).
  item: {
    axis: (id: string) => string | undefined;
    kind: (kind: string) => string | undefined;
    appliesTo: (value: unknown) => string | undefined;
    due: (value: unknown) => string | undefined;
    evidence: (value: unknown) => string | undefined;
  };
  college: string;
  // A role's labels in the college's language.
  labels: (labels: Record<string, string>) => string;
  dateTime: (iso: string) => string;
  // A calendar day, YYYY-MM-DD.
  day: (day: string) => string;
  list: (items: string[]) => string;
};

// The words under audit.* in the catalog, with the values they name, and whether it has one.
export type Words = ((
  key: string,
  values?: Record<string, string>,
) => string) & {
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
      // A kind of notification, of a day of a term's calendar, or of an item's task: no name is two.
      case "kind":
        return (
          lookups.notificationKind(value) ??
          lookups.calendarKind(value) ??
          lookups.item.kind(value) ??
          value
        );
      case "axisId":
        return lookups.item.axis(value) ?? value;
      // A term, and the term a department's plan was copied from (Step 19).
      case "termId":
      case "fromTermId":
        return lookups.term(value) ?? value;
      // A Rayat report, by the name everyone gives it (Step 16).
      case "report":
        return value.toUpperCase();
      case "startsOn":
      case "endsOn":
        return lookups.day(value);
      case "status":
        return words.has(`termStatus.${value}`)
          ? words(`termStatus.${value}`)
          : value;
      // What made the generation engine go over a term's tasks again (Step 20).
      case "cause":
        return words.has(`causes.${value}`) ? words(`causes.${value}`) : value;
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
  if (isRecord(value)) {
    const said =
      field === "labels"
        ? lookups.labels(value as Record<string, string>)
        : field === "appliesTo"
          ? (lookups.item.appliesTo(value) ??
            ("userId" in value ? words("unknownPerson") : undefined))
          : field === "due"
            ? lookups.item.due(value)
            : field === "evidence"
              ? lookups.item.evidence(value)
              : undefined;
    if (said !== undefined) return said;
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
    // The term's framework, by the term (Step 15); an item of it by its title first (UX review 2).
    case "framework": {
      const diff = entry.diff ?? {};
      const was = isRecord(diff.to) ? diff.to : diff.from;
      if (!isRecord(was) || typeof was.termId !== "string") return id;
      const term = lookups.term(was.termId) ?? id;
      return typeof was.title === "string"
        ? [
            words("quoted", { title: was.title }),
            words("groups.framework"),
            term,
          ].join(" · ")
        : term;
    }
    // A Rayat import by its report and term (Step 16).
    case "rayatImport": {
      const { report, termId } = entry.diff ?? {};
      return typeof report === "string" && typeof termId === "string"
        ? `${report.toUpperCase()} · ${lookups.term(termId) ?? termId}`
        : id;
    }
    // A section's transfer by the section and its term (Step 17).
    case "sectionTransfer": {
      const diff = entry.diff ?? {};
      const was = isRecord(diff.to)
        ? diff.to
        : isRecord(diff.from)
          ? diff.from
          : diff;
      return typeof was.sectionRef === "string" &&
        typeof was.termId === "string"
        ? `${was.sectionRef} · ${lookups.term(was.termId) ?? was.termId}`
        : id;
    }
    // A department's section template by its title, department and term, as it became or was
    // taken out (Step 18).
    case "sectionTemplate": {
      const diff = entry.diff ?? {};
      const was = isRecord(diff.to) ? diff.to : diff.from;
      return isRecord(was) &&
        typeof was.title === "string" &&
        typeof was.departmentId === "string" &&
        typeof was.termId === "string"
        ? [
            was.title,
            lookups.department(was.departmentId) ?? was.departmentId,
            lookups.term(was.termId) ?? was.termId,
          ].join(" · ")
        : id;
    }
    // A department's plan by its department and term (Step 19); an item of it by its title first
    // (UX review 2).
    case "plan": {
      const diff = entry.diff ?? {};
      const was = isRecord(diff.to) ? diff.to : diff.from;
      return isRecord(was) &&
        typeof was.departmentId === "string" &&
        typeof was.termId === "string"
        ? [
            ...(typeof was.title === "string"
              ? [words("quoted", { title: was.title })]
              : []),
            lookups.department(was.departmentId) ?? was.departmentId,
            lookups.term(was.termId) ?? was.termId,
          ].join(" · ")
        : id;
    }
    // A portfolio axis by its title before the change (Step 14).
    case "axis": {
      const was = entry.diff?.from;
      return isRecord(was) && typeof was.title === "string" ? was.title : id;
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
