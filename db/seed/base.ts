import { sql } from "drizzle-orm";
import {
  type PermissionKey,
  rolePermissions,
  roles,
} from "../../src/modules/access/index.ts";
import { colleges } from "../../src/modules/org/index.ts";
import { parseSeedEnv } from "../../src/platform/config/env.ts";
import { createDb, type Db } from "../../src/platform/db/client.ts";

// The role that holds every permission. pnpm admin:create makes its first member.
export const systemRole = {
  key: "system-admin",
  labels: { ar: "مدير النظام" },
};

// The roles every college starts with and the keys each holds, as the brief describes them
// (docs/PLAN.md, section 1). The secretary's and the quality reviewer's keys arrive with their
// screens (Steps 33 and 37). Admins change all of it on the grid.
export const defaultRoles: {
  key: string;
  labels: Record<string, string>;
  permissions: PermissionKey[];
}[] = [
  {
    key: "dean",
    labels: { ar: "العميد" },
    permissions: ["indicators.view.college"],
  },
  {
    key: "vice-dean",
    labels: { ar: "وكيل التدريب" },
    permissions: [
      "term.manage",
      "framework.publish",
      "rayat.import",
      "indicators.view.college",
    ],
  },
  {
    key: "head",
    labels: { ar: "رئيس القسم" },
    permissions: [
      "plan.edit",
      "plan.publish",
      "assignment.manage",
      "review.decide",
      "portfolio.approve",
    ],
  },
  { key: "secretary", labels: { ar: "أمين القسم" }, permissions: [] },
  { key: "trainer", labels: { ar: "المدرب" }, permissions: ["task.complete"] },
  { key: "quality-reviewer", labels: { ar: "مراجع الجودة" }, permissions: [] },
];

// Idempotent: inserts the one college only while none exists and never updates it, and each of its
// roles, with its keys, only while the college has no role with that key, so a re-run changes
// nothing and never undoes the grid. Returns the id of the first college, the one db:seed made.
export async function seedBase(
  db: Db,
  college: { name: string; shortName: string },
) {
  return db.transaction(async (tx) => {
    // Runs that start together would each see no college and insert one; the lock makes them take turns.
    await tx.execute(sql`lock table ${colleges} in share row exclusive mode`);
    await tx.execute(sql`
      insert into ${colleges} (name, short_name)
      select ${college.name}, ${college.shortName}
      where not exists (select 1 from ${colleges})`);
    const [row] = await tx
      .select({ id: colleges.id })
      .from(colleges)
      .orderBy(colleges.createdAt, colleges.id)
      .limit(1);
    await tx
      .insert(roles)
      .values({ collegeId: row.id, ...systemRole, system: true })
      .onConflictDoNothing();
    for (const { permissions, ...role } of defaultRoles) {
      const [added] = await tx
        .insert(roles)
        .values({ collegeId: row.id, ...role })
        .onConflictDoNothing()
        .returning({ id: roles.id });
      if (added && permissions.length > 0) {
        await tx
          .insert(rolePermissions)
          .values(
            permissions.map((permission) => ({ roleId: added.id, permission })),
          );
      }
    }
    return row.id;
  });
}

if (import.meta.main) {
  try {
    const env = parseSeedEnv(process.env);
    const { db, pool } = createDb(env.DATABASE_URL);
    try {
      await seedBase(db, {
        name: env.SEED_COLLEGE_NAME,
        shortName: env.SEED_COLLEGE_SHORT_NAME,
      });
    } finally {
      await pool.end();
    }
    console.log("db:seed finished.");
  } catch (error) {
    // Drizzle wraps driver errors, such as a refused connection, in a "Failed query" error.
    const { message, cause } = error as Error;
    console.error(
      `db:seed failed: ${message}`,
      cause instanceof Error ? cause.message : "",
    );
    process.exit(1);
  }
}
