import { getFormatter, getTranslations } from "next-intl/server";
import { cache } from "react";
import type { z } from "zod";
import { listDirectory, listRoles, roleLabel } from "@/modules/access";
import { type AuditEntry, auditActions } from "@/modules/audit";
import { listAxes } from "@/modules/axes";
import { planItemInput } from "@/modules/framework";
import { findCollege, listDepartments } from "@/modules/org";
import { getSetting } from "@/modules/settings";
import { listExamPeriodTypes, listTerms } from "@/modules/terms";
import { itemVocabulary } from "../_items/vocabulary.ts";
import { describeEvent, type Lookups, type Words } from "./describe.ts";
import type { EventRow } from "./event-list.tsx";

// The college's people, read once per request: the names events carry, and whom a search finds.
export const collegePeople = cache((collegeId: string) =>
  listDirectory(collegeId),
);

// The words under audit.* as describeEvent reads them, by keys it builds.
export async function auditWords(): Promise<Words> {
  const t = await getTranslations("audit");
  type Key = Parameters<typeof t>[0];
  return Object.assign(
    (key: string, values?: Record<string, string>) => t(key as Key, values),
    { has: (key: string) => t.has(key as Key) },
  );
}

// Each action the log records with its name and its group's, for the viewer's filter.
export async function actionChoices() {
  const words = await auditWords();
  return auditActions.map((action) => ({
    value: action,
    label: words(`actions.${action}`),
    group: words(`groups.${action.split(".")[0]}`),
  }));
}

// A field's words when its value has the shape it is checked against, and nothing otherwise.
const worded =
  <T>(schema: z.ZodType<T>, words: (value: T) => string | undefined) =>
  (value: unknown) => {
    const read = schema.safeParse(value);
    return read.success ? words(read.data) : undefined;
  };

// What names the ids events carry: the college's people, departments, roles, terms and axes, and
// the catalog's keys, settings and kinds, and the words of the framework's and the plans' items.
export async function auditLookups(collegeId: string): Promise<Lookups> {
  const [
    people,
    departments,
    roles,
    college,
    language,
    keys,
    settings,
    kinds,
    terms,
    calendarKinds,
    format,
    axes,
    periodTypes,
    itemWords,
  ] = await Promise.all([
    collegePeople(collegeId),
    listDepartments(collegeId),
    listRoles(collegeId),
    findCollege(),
    getSetting("locale.language", { collegeId }),
    getTranslations("roles.permissions"),
    getTranslations("settings.fields"),
    getTranslations("notifications.kinds"),
    listTerms(collegeId),
    getTranslations("terms.kinds"),
    getFormatter(),
    listAxes(collegeId),
    listExamPeriodTypes(collegeId),
    getTranslations("framework"),
  ]);
  const names = new Map(people.map(({ userId, name }) => [userId, name]));
  const { words: item } = itemVocabulary({
    t: itemWords,
    periodTypes,
    format,
    axes: axes.flatMap((group) => group.axes),
    roles: new Map(
      roles.map((role) => [role.id, roleLabel(role.labels, language)]),
    ),
    people: new Map(
      people.map(({ userId, name, employeeNumber }) => [
        userId,
        { name, employeeNumber },
      ]),
    ),
    accepted: [],
  });
  type KeyLabel = Parameters<typeof keys>[0];
  type SettingLabel = Parameters<typeof settings>[0];
  type KindLabel = Parameters<typeof kinds>[0];
  type CalendarKind = Parameters<typeof calendarKinds>[0];
  return {
    person: (userId) => names.get(userId),
    department: (id) => departments.find((each) => each.id === id)?.name,
    role: (key) => {
      const role = roles.find((each) => each.key === key);
      return role && roleLabel(role.labels, language);
    },
    roleById: (id) => {
      const role = roles.find((each) => each.id === id);
      return role && roleLabel(role.labels, language);
    },
    permission: (key) =>
      keys.has(`${key}.label` as KeyLabel)
        ? keys(`${key}.label` as KeyLabel)
        : key,
    setting: (key) =>
      settings.has(`${key}.label` as SettingLabel)
        ? settings(`${key}.label` as SettingLabel)
        : undefined,
    notificationKind: (kind) =>
      kinds.has(`${kind}.label` as KindLabel)
        ? kinds(`${kind}.label` as KindLabel)
        : undefined,
    term: (id) => terms.find((each) => each.id === id)?.name,
    calendarKind: (kind) =>
      calendarKinds.has(kind as CalendarKind)
        ? calendarKinds(kind as CalendarKind)
        : undefined,
    item: {
      axis: item.axis,
      kind: item.kind,
      appliesTo: worded(planItemInput.shape.appliesTo, item.appliesTo),
      due: worded(planItemInput.shape.due, item.due),
      evidence: worded(planItemInput.shape.evidence, item.evidence),
    },
    college: college?.name ?? "",
    labels: (labels) => roleLabel(labels, language),
    dateTime: (iso) =>
      format.dateTime(new Date(iso), {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    // A day of the calendar, not an instant: read and written on UTC's, so no clock moves it.
    day: (day) =>
      format.dateTime(new Date(`${day}T00:00:00Z`), {
        dateStyle: "medium",
        timeZone: "UTC",
      }),
    list: (items) => format.list(items),
  };
}

// The events as a list shows them: named, with their day and time on the college's clock.
export async function eventRows(
  collegeId: string,
  entries: readonly AuditEntry[],
): Promise<EventRow[]> {
  const [lookups, words, format] = await Promise.all([
    auditLookups(collegeId),
    auditWords(),
    getFormatter(),
  ]);
  return entries.map((entry) => {
    const { at, ...event } = describeEvent(entry, lookups, words);
    return {
      ...event,
      kind: entry.action.split(".")[0],
      iso: at.toISOString(),
      day: format.dateTime(at, { dateStyle: "full" }),
      time: format.dateTime(at, { timeStyle: "short" }),
    };
  });
}
