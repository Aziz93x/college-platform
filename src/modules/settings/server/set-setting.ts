import { and, eq, sql } from "drizzle-orm";
import { type Db, getDb } from "../../../platform/db/client.ts";
import { writeAudit } from "../../audit/index.ts";
import {
  type SettingKey,
  type SettingValue,
  settingsRegistry,
} from "../domain/registry.ts";
import { settingValue } from "./get-setting.ts";
import { settings } from "./schema.ts";

// Who changes a setting, for its audit event. The caller has authorized them for the setting's
// permission (settingsRegistry[key].permission).
type Change = {
  collegeId: string;
  actorId: string;
  ip?: string | null;
  userAgent?: string | null;
};

type SetResult<K extends SettingKey> =
  | { status: "saved"; value: SettingValue<K> }
  | { status: "unchanged"; value: SettingValue<K> }
  | { status: "invalid" };

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

// Drizzle writes null as SQL NULL, which the column refuses; a nullable setting stores JSON null.
const jsonb = (value: unknown) => (value === null ? sql`'null'::jsonb` : value);

// Stores a new value for the college once it passes the key's schema, and records the change as
// setting.update with the value before and after. A value equal to the one in force changes nothing.
export async function setSetting<K extends SettingKey>(
  key: K,
  value: unknown,
  change: Change,
  db: Db = getDb(),
): Promise<SetResult<K>> {
  const parsed = settingsRegistry[key].schema.safeParse(value);
  if (!parsed.success) return { status: "invalid" };
  const next = parsed.data as SettingValue<K>;
  return db.transaction(async (tx) => {
    // The row is locked while it changes, so two saves at once record each change once.
    const current = await tx
      .select({ value: settings.value })
      .from(settings)
      .where(
        and(eq(settings.collegeId, change.collegeId), eq(settings.key, key)),
      )
      .for("update");
    const stored = new Map(current.map((row) => [key as string, row.value]));
    const before = settingValue(key, stored, change.collegeId);
    if (same(before, next)) return { status: "unchanged", value: before };
    await tx
      .insert(settings)
      .values({ collegeId: change.collegeId, key, value: jsonb(next) })
      .onConflictDoUpdate({
        target: [settings.collegeId, settings.key],
        set: {
          value: jsonb(next),
          version: sql`${settings.version} + 1`,
          updatedAt: sql`now()`,
        },
      });
    await writeAudit(
      {
        collegeId: change.collegeId,
        actorId: change.actorId,
        action: "setting.update",
        entityType: "setting",
        entityId: key,
        diff: { from: before, to: next },
        ip: change.ip,
        userAgent: change.userAgent,
      },
      tx,
    );
    return { status: "saved", value: next };
  });
}

// Removes the college's value, so the registered default applies again (and any later change to
// that default), and records it as setting.reset. Without a stored value, nothing changes.
export async function resetSetting<K extends SettingKey>(
  key: K,
  change: Change,
  db: Db = getDb(),
): Promise<{ status: "reset" | "unchanged"; value: SettingValue<K> }> {
  const value = settingsRegistry[key].default as SettingValue<K>;
  return db.transaction(async (tx) => {
    const removed = await tx
      .delete(settings)
      .where(
        and(eq(settings.collegeId, change.collegeId), eq(settings.key, key)),
      )
      .returning({ value: settings.value });
    if (removed.length === 0) return { status: "unchanged", value };
    await writeAudit(
      {
        collegeId: change.collegeId,
        actorId: change.actorId,
        action: "setting.reset",
        entityType: "setting",
        entityId: key,
        diff: { from: removed[0].value, to: value },
        ip: change.ip,
        userAgent: change.userAgent,
      },
      tx,
    );
    return { status: "reset", value };
  });
}
