import { and, eq } from "drizzle-orm";
import { type Db, getDb } from "../../../platform/db/client.ts";
import { logger } from "../../../platform/logging/logger.ts";
import {
  type SettingKey,
  type SettingValue,
  settingsRegistry,
} from "../domain/registry.ts";
import { settings } from "./schema.ts";

// The stored value for the college, or the registered default while none is stored. A stored value
// that fails its schema (one a later step's stricter schema refuses, or a row written by hand) gives
// the default too, and is logged by its key, never its value, so one bad row cannot take down every
// page.
export async function getSetting<K extends SettingKey>(
  key: K,
  scope: { collegeId: string },
  db: Db = getDb(),
): Promise<SettingValue<K>> {
  // TypeScript cannot tie an entry read with a generic key back to that key, hence the casts below.
  const setting = settingsRegistry[key];
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.collegeId, scope.collegeId), eq(settings.key, key)));
  if (!row) return setting.default as SettingValue<K>;
  const parsed = setting.schema.safeParse(row.value);
  if (!parsed.success) {
    logger.error(
      { setting: key, collegeId: scope.collegeId },
      "stored setting fails its schema; its default applies",
    );
    return setting.default as SettingValue<K>;
  }
  return parsed.data as SettingValue<K>;
}
