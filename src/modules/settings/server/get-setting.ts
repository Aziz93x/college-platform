import { and, eq } from "drizzle-orm";
import { type Db, getDb } from "../../../platform/db/client.ts";
import {
  type SettingKey,
  type SettingValue,
  settingsRegistry,
} from "../domain/registry.ts";
import { settings } from "./schema.ts";

// The stored value for the college, or the registered default while none is stored.
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
    throw new Error(`Invalid stored value for setting ${key}`, {
      cause: parsed.error,
    });
  }
  return parsed.data as SettingValue<K>;
}
