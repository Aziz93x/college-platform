import { z } from "zod";
import { languages } from "../../../platform/i18n/language.ts";
import { foldCase, oneLine } from "../../../platform/validation/text.ts";

// An IANA time zone name, canonical or alias (UTC, Europe/Kyiv), that Intl can format with.
// Intl.supportedValuesOf lists only the names ICU treats as canonical, and those change between versions.
// Offsets such as +03:00 are refused: PostgreSQL reads them as POSIX zones, with the sign inverted.
function isTimeZoneName(value: string) {
  if (/^[+-]/.test(value)) return false;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// The longest "remember this device" may last; Better Auth's session lifetime is set to it.
export const REMEMBERED_DEVICE_DAYS_MAX = 90;

// The days of the week, numbered from Sunday as JavaScript dates and the date range picker count them.
export const weekdays = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

// The digits dates and numbers are written in: Latin or Arabic-Indic. They become the locale's
// numbering system (src/i18n/locale.ts).
const numberingSystems = ["latn", "arab"] as const;

// The settings screen's tabs, in this order; each setting belongs to one.
export const settingGroups = [
  "platform",
  "locale",
  "calendar",
  "security",
  "files",
  "rayat",
  "review",
  "reminders",
] as const;
export type SettingGroup = (typeof settingGroups)[number];

// What a number counts, shown beside it on the settings screen (the message settings.units.<unit>).
// A percentage is set with a slider.
export type SettingUnit =
  | "characters"
  | "attempts"
  | "minutes"
  | "hours"
  | "days"
  | "months"
  | "megabytes"
  | "percent"
  | "items"
  | "weeks"
  | "hourOfDay";

// The permission key (src/modules/access) that edits a setting: the platform's own settings take
// settings.manage, and a setting that belongs to another role names that role's key, such as the
// vice-dean's for how a term's weeks are counted (Step 13).
const MANAGE = "settings.manage";
const TERM = "term.manage";

// A Rayat report's column map: the header of each column the platform reads, by what it reads it
// as (src/modules/rayat, which a unit test keeps these fields in step with), no two the same in any
// spacing or case. Null until the base seed writes Rayat's own (docs/PLAN.md, section 9).
function columnMap<F extends string>(fields: readonly F[]) {
  const header = z.string().trim().min(1).max(100);
  return z
    .object(
      Object.fromEntries(fields.map((field) => [field, header])) as Record<
        F,
        typeof header
      >,
    )
    .refine(
      (map) =>
        new Set(
          Object.values(map as Record<string, string>).map((text) =>
            foldCase(oneLine(text)),
          ),
        ).size === fields.length,
    )
    .nullable();
}

// Every setting the code reads: its scope, the screen's group, the permission that edits it, the
// schema a stored value must pass, the default used while none is stored, and the unit of a number.
// Its label and description are the messages settings.fields.<key>.label and .description.
// "college" is the only scope so far, so the settings table keys a value by (college_id, key);
// the first setting with another scope adds that scope to the table.
export const settingsRegistry = {
  // The platform's name on the login page, in the sidebar, in page titles and in the authenticator
  // app; null uses the message catalog's.
  "platform.name": {
    scope: "college",
    group: "platform",
    permission: MANAGE,
    schema: z.string().trim().min(1).max(80).nullable(),
    default: null,
  },
  // The pilot banner on every page while the platform is on trial, and its text (null uses the
  // message catalog's).
  "pilot.banner": {
    scope: "college",
    group: "platform",
    permission: MANAGE,
    schema: z.boolean(),
    default: true,
  },
  "pilot.bannerText": {
    scope: "college",
    group: "platform",
    permission: MANAGE,
    schema: z.string().trim().min(1).max(200).nullable(),
    default: null,
  },
  // The college logo on the login page, off until the dean approves it in writing (docs/PLAN.md, section 8).
  "login.showLogo": {
    scope: "college",
    group: "platform",
    permission: MANAGE,
    schema: z.boolean(),
    default: false,
  },
  // The order of the shell's pages per role: role key to page ids. A role without an order, and
  // the pages an order leaves out, follow the order the code lists them in. A map has no control
  // on the settings screen: each role's order is edited on the role's page, with the grid's key.
  "navigation.order": {
    scope: "college",
    group: "platform",
    permission: "roles.manage",
    schema: z.record(z.string(), z.array(z.string())),
    default: {},
  },
  // The interface language: one of the languages with a catalog in messages/. The document
  // direction follows from it.
  "locale.language": {
    scope: "college",
    group: "locale",
    permission: MANAGE,
    schema: z.enum(languages),
    default: languages[0],
  },
  "locale.timeZone": {
    scope: "college",
    group: "locale",
    permission: MANAGE,
    schema: z.string().trim().refine(isTimeZoneName),
    default: "Asia/Riyadh",
  },
  // The first column of every calendar.
  "locale.weekStart": {
    scope: "college",
    group: "locale",
    permission: MANAGE,
    schema: z.enum(weekdays),
    default: "sunday",
  },
  "locale.digits": {
    scope: "college",
    group: "locale",
    permission: MANAGE,
    schema: z.enum(numberingSystems),
    default: "latn",
  },
  // The Umm al-Qura (Hijri) date beside the Gregorian one.
  "locale.hijri": {
    scope: "college",
    group: "locale",
    permission: MANAGE,
    schema: z.boolean(),
    default: false,
  },
  // How a term's weeks are counted (Step 13): the days worked in a week, from its first day
  // (locale.weekStart), and whether a week whose working days are all holidays, an Eid break, goes
  // without a number, so the term runs a week longer.
  "calendar.workingDays": {
    scope: "college",
    group: "calendar",
    permission: TERM,
    schema: z.int().min(1).max(7),
    default: 5,
    unit: "days",
  },
  "calendar.skipHolidayWeeks": {
    scope: "college",
    group: "calendar",
    permission: TERM,
    schema: z.boolean(),
    default: true,
  },
  // The usual length of a term: a new term's form starts from it.
  "calendar.termWeeks": {
    scope: "college",
    group: "calendar",
    permission: TERM,
    schema: z.int().min(1).max(52),
    default: 18,
    unit: "weeks",
  },
  // Whether holding a key that requires two-factor makes its holder set it up before anything else.
  // Off, two-factor is each person's own choice on their profile (ADR-0014).
  "auth.requireTwoFactor": {
    scope: "college",
    group: "security",
    permission: MANAGE,
    reauth: true,
    schema: z.boolean(),
    default: false,
  },
  // Password policy: the shortest password a person may set.
  "auth.passwordMinLength": {
    scope: "college",
    group: "security",
    permission: MANAGE,
    reauth: true,
    schema: z.int().min(8).max(64),
    default: 10,
    unit: "characters",
  },
  // Attempts within lockoutMinutes of the first, from any address, that lock what was typed (an
  // email or an employee number, with or without an account), and for how long (lockout.ts).
  "auth.lockoutThreshold": {
    scope: "college",
    group: "security",
    permission: MANAGE,
    reauth: true,
    schema: z.int().min(3).max(20),
    default: 5,
    unit: "attempts",
  },
  "auth.lockoutMinutes": {
    scope: "college",
    group: "security",
    permission: MANAGE,
    reauth: true,
    schema: z.int().min(1).max(1440),
    default: 15,
    unit: "minutes",
  },
  // Sign-in attempts allowed per identifier and address in each window, so one address shared by a
  // whole workshop never blocks the others (ADR-0008).
  "auth.signInAttempts": {
    scope: "college",
    group: "security",
    permission: MANAGE,
    reauth: true,
    schema: z.int().min(5).max(100),
    default: 10,
    unit: "attempts",
  },
  "auth.signInWindowMinutes": {
    scope: "college",
    group: "security",
    permission: MANAGE,
    reauth: true,
    schema: z.int().min(1).max(1440),
    default: 15,
    unit: "minutes",
  },
  // A session on a device that is not remembered ends after this long without a request, and
  // after this many hours in any case.
  "auth.idleMinutes": {
    scope: "college",
    group: "security",
    permission: MANAGE,
    reauth: true,
    schema: z.int().min(5).max(1440),
    default: 60,
    unit: "minutes",
  },
  "auth.sessionHours": {
    scope: "college",
    group: "security",
    permission: MANAGE,
    reauth: true,
    schema: z.int().min(1).max(24),
    default: 12,
    unit: "hours",
  },
  // How long "remember this device" keeps a person signed in.
  "auth.rememberedDeviceDays": {
    scope: "college",
    group: "security",
    permission: MANAGE,
    reauth: true,
    schema: z.int().min(1).max(REMEMBERED_DEVICE_DAYS_MAX),
    default: 30,
    unit: "days",
  },
  // A sensitive change (a security setting here; the role grid and resets from Steps 9 and 10)
  // asks for the password again when it was last typed longer ago than this.
  "auth.reauthMinutes": {
    scope: "college",
    group: "security",
    permission: MANAGE,
    reauth: true,
    schema: z.int().min(1).max(120),
    default: 15,
    unit: "minutes",
  },
  // How long the audit log keeps an event before the daily purge removes it. The database keeps at
  // least 12 months whatever this says (migration 0010); the default waits for the data
  // classification the General Administration approves (ADR-0008).
  "audit.retentionMonths": {
    scope: "college",
    group: "security",
    permission: MANAGE,
    reauth: true,
    schema: z.int().min(12).max(120),
    default: 60,
    unit: "months",
  },
  // The extensions an evidence file may have (Step 25 checks its contents too).
  "files.acceptedTypes": {
    scope: "college",
    group: "files",
    permission: MANAGE,
    schema: z
      .array(
        z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9]{1,10}$/),
      )
      .min(1)
      .max(30)
      .refine((types) => new Set(types).size === types.length),
    default: ["pdf", "jpg", "jpeg", "png", "heic", "docx", "xlsx", "pptx"],
  },
  // How the Rayat import finds each column of SS01, SF01 and SO01 (Step 16). The mapping version an
  // import records is the stored value's version.
  "rayat.columns.ss01": {
    scope: "college",
    group: "rayat",
    permission: MANAGE,
    schema: columnMap([
      "term",
      "department",
      "courseCode",
      "courseName",
      "creditHours",
      "sectionRef",
      "deliveryMode",
      "day",
      "time",
      "building",
      "room",
      "capacity",
      "enrolled",
      "remaining",
      "trainerNumber",
    ]),
    default: null,
  },
  "rayat.columns.sf01": {
    scope: "college",
    group: "rayat",
    permission: MANAGE,
    schema: columnMap([
      "term",
      "department",
      "courseCode",
      "sectionRef",
      "traineeNumber",
      "registrationStatus",
      "traineeStatus",
    ]),
    default: null,
  },
  "rayat.columns.so01": {
    scope: "college",
    group: "rayat",
    permission: MANAGE,
    schema: columnMap([
      "termCode",
      "term",
      "department",
      "subjectCode",
      "courseNumber",
      "traineeNumber",
      "courseStatus",
      "absencePercent",
      "absenceHours",
    ]),
    default: null,
  },
  // Whether the term's framework waits for the dean's endorsement before the vice-dean publishes it
  // (Step 15).
  "framework.requireEndorsement": {
    scope: "college",
    group: "review",
    permission: MANAGE,
    schema: z.boolean(),
    default: false,
  },
  // The weekly digest's day and hour on the college's clock (Step 12).
  "reminders.digestDay": {
    scope: "college",
    group: "reminders",
    permission: MANAGE,
    schema: z.enum(weekdays),
    default: "sunday",
  },
  "reminders.digestHour": {
    scope: "college",
    group: "reminders",
    permission: MANAGE,
    schema: z.int().min(0).max(23),
    default: 7,
    unit: "hourOfDay",
  },
} as const satisfies Record<
  string,
  {
    scope: "college";
    group: SettingGroup;
    permission: string;
    schema: z.ZodType;
    default: unknown;
    unit?: SettingUnit;
    // Changing it asks for the password again (auth.reauthMinutes).
    reauth?: true;
  }
>;

export type SettingKey = keyof typeof settingsRegistry;

export type SettingValue<K extends SettingKey> = z.infer<
  (typeof settingsRegistry)[K]["schema"]
>;

export function isSettingKey(value: string): value is SettingKey {
  return Object.hasOwn(settingsRegistry, value);
}

// A setting that decides who gets in and for how long, or how long history is kept, asks for the
// password again when it changes (auth.reauthMinutes).
export function needsPassword(key: SettingKey) {
  return "reauth" in settingsRegistry[key];
}
