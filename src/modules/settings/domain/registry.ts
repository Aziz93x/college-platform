import { z } from "zod";
import { languages } from "../../../platform/i18n/language.ts";

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

// Every setting the code reads: its scope, the schema a stored value must pass and the default used while none is stored.
// "college" is the only scope so far, so the settings table keys a value by (college_id, key);
// the first setting with another scope adds that scope to the table.
export const settingsRegistry = {
  "locale.timeZone": {
    scope: "college",
    schema: z.string().refine(isTimeZoneName),
    default: "Asia/Riyadh",
  },
  // The interface language: one of the languages with a catalog in messages/. The document
  // direction follows from it.
  "locale.language": {
    scope: "college",
    schema: z.enum(languages),
    default: languages[0],
  },
  // The order of the shell's pages per role: role key to page ids. A role without an order, and
  // the pages an order leaves out, follow the order the code lists them in.
  "navigation.order": {
    scope: "college",
    schema: z.record(z.string(), z.array(z.string())),
    default: {},
  },
  // The platform's name on the login page and in the authenticator app; null uses the message catalog's.
  "platform.name": {
    scope: "college",
    schema: z.string().trim().min(1).max(80).nullable(),
    default: null,
  },
  // The pilot banner on every page while the platform is on trial, and its text (null uses the
  // message catalog's).
  "pilot.banner": { scope: "college", schema: z.boolean(), default: true },
  "pilot.bannerText": {
    scope: "college",
    schema: z.string().trim().min(1).max(200).nullable(),
    default: null,
  },
  // The college logo on the login page, off until the dean approves it in writing (docs/PLAN.md, section 8).
  "login.showLogo": { scope: "college", schema: z.boolean(), default: false },
  // Password policy: the shortest password a person may set.
  "auth.passwordMinLength": {
    scope: "college",
    schema: z.int().min(8).max(64),
    default: 10,
  },
  // Wrong passwords within lockoutMinutes, from any address, that lock an account (or what was
  // typed when no account matches), and for how long (identity's lockout.ts).
  "auth.lockoutThreshold": {
    scope: "college",
    schema: z.int().min(3).max(20),
    default: 5,
  },
  "auth.lockoutMinutes": {
    scope: "college",
    schema: z.int().min(1).max(1440),
    default: 15,
  },
  // Sign-in attempts allowed per account and address in each window, so one address shared by a
  // whole workshop never blocks the others (ADR-0008).
  "auth.signInAttempts": {
    scope: "college",
    schema: z.int().min(5).max(100),
    default: 10,
  },
  "auth.signInWindowMinutes": {
    scope: "college",
    schema: z.int().min(1).max(1440),
    default: 15,
  },
  // A session on a device that is not remembered ends after this long without a request, and
  // after this many hours in any case.
  "auth.idleMinutes": {
    scope: "college",
    schema: z.int().min(5).max(1440),
    default: 60,
  },
  "auth.sessionHours": {
    scope: "college",
    schema: z.int().min(1).max(24),
    default: 12,
  },
  // How long "remember this device" keeps a person signed in.
  "auth.rememberedDeviceDays": {
    scope: "college",
    schema: z.int().min(1).max(REMEMBERED_DEVICE_DAYS_MAX),
    default: 30,
  },
} as const;

export type SettingKey = keyof typeof settingsRegistry;

export type SettingValue<K extends SettingKey> = z.infer<
  (typeof settingsRegistry)[K]["schema"]
>;
