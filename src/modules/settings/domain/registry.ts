import { z } from "zod";

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

// Every setting the code reads: its scope, the schema a stored value must pass and the default used while none is stored.
// "college" is the only scope so far, so the settings table keys a value by (college_id, key);
// the first setting with another scope adds that scope to the table.
export const settingsRegistry = {
  "locale.timeZone": {
    scope: "college",
    schema: z.string().refine(isTimeZoneName),
    default: "Asia/Riyadh",
  },
} as const;

export type SettingKey = keyof typeof settingsRegistry;

export type SettingValue<K extends SettingKey> = z.infer<
  (typeof settingsRegistry)[K]["schema"]
>;
