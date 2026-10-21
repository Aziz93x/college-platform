import { and, eq, sql } from "drizzle-orm";
import { type Db, getDb, type Tx } from "../../../platform/db/client.ts";
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

// Holds the college's key until the transaction ends, whether a row is stored yet or not, so two
// changes at once run one after the other: each reads the value the other left (Audit 3).
const lockKey = (tx: Tx, collegeId: string, key: SettingKey) =>
  tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`setting:${collegeId}:${key}`}, 0))`,
  );

// Stores a new value for the college once it passes the key's schema, and records the change as
// setting.update with the value before and after. A value equal to the one in force changes nothing.
// Given a function, it builds the new value from the one in force, under the lock, so a change that
// merges into the value, such as one role's page order, never drops another's made at the same time.
export function setSetting<K extends SettingKey>(
  key: K,
  value: (current: SettingValue<K>) => unknown,
  change: Change,
  db?: Db,
): Promise<SetResult<K>>;
export function setSetting<K extends SettingKey>(
  key: K,
  value: unknown,
  change: Change,
  db?: Db,
): Promise<SetResult<K>>;
export async function setSetting<K extends SettingKey>(
  key: K,
  value: unknown,
  change: Change,
  db: Db = getDb(),
): Promise<SetResult<K>> {
  return db.transaction(async (tx) => {
    await lockKey(tx, change.collegeId, key);
    const current = await tx
      .select({ value: settings.value })
      .from(settings)
      .where(
        and(eq(settings.collegeId, change.collegeId), eq(settings.key, key)),
      );
    const stored = new Map(current.map((row) => [key as string, row.value]));
    const before = settingValue(key, stored, change.collegeId);
    const parsed = settingsRegistry[key].schema.safeParse(
      typeof value === "function" ? value(before) : value,
    );
    if (!parsed.success) return { status: "invalid" };
    const next = parsed.data as SettingValue<K>;
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
    await lockKey(tx, change.collegeId, key);
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
