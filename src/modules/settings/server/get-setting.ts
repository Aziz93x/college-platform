import { eq } from "drizzle-orm";
import { cache } from "react";
import { type Db, getDb } from "../../../platform/db/client.ts";
import { logger } from "../../../platform/logging/logger.ts";
import {
  type SettingKey,
  type SettingValue,
  settingsRegistry,
} from "../domain/registry.ts";
import { settings } from "./schema.ts";

// Every value the college has stored, by key, read once per request: React's cache() lasts one
// server render, so the next request reads them again and sees a change at once (ADR-0007 keeps
// nothing across requests). Outside a render, in a server action or a script, it reads each time.
export const storedSettings = cache(
  async (collegeId: string, db: Db = getDb()) => {
    const rows = await db
      .select({ key: settings.key, value: settings.value })
      .from(settings)
      .where(eq(settings.collegeId, collegeId));
    return new Map<string, unknown>(
      rows.map((row) => [row.key, row.value]),
    ) as ReadonlyMap<string, unknown>;
  },
);

// The value a stored row gives, or the registered default while none is stored. A stored value
// that fails its schema (one a later step's stricter schema refuses, or a row written by hand) gives
// the default too, and is logged by its key, never its value, so one bad row cannot take down every
// page.
export function settingValue<K extends SettingKey>(
  key: K,
  stored: ReadonlyMap<string, unknown>,
  collegeId: string,
): SettingValue<K> {
  // TypeScript cannot tie an entry read with a generic key back to that key, hence the casts below.
  const setting = settingsRegistry[key];
  if (!stored.has(key)) return setting.default as SettingValue<K>;
  const parsed = setting.schema.safeParse(stored.get(key));
  if (!parsed.success) {
    logger.error(
      { setting: key, collegeId },
      "stored setting fails its schema; its default applies",
    );
    return setting.default as SettingValue<K>;
  }
  return parsed.data as SettingValue<K>;
}

export async function getSetting<K extends SettingKey>(
  key: K,
  scope: { collegeId: string },
  db?: Db,
): Promise<SettingValue<K>> {
  // cache() keys on the arguments it is given, so the app's calls, which pass no database, share
  // one read with a page's storedSettings(collegeId) (as findCollegeId does, Audit 3).
  const stored = await (db
    ? storedSettings(scope.collegeId, db)
    : storedSettings(scope.collegeId));
  return settingValue(key, stored, scope.collegeId);
}
