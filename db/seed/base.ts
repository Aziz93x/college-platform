import { sql } from "drizzle-orm";
import {
  type PermissionKey,
  rolePermissions,
  roles,
} from "../../src/modules/access/index.ts";
import { colleges } from "../../src/modules/org/index.ts";
import {
  type BreakRule,
  estimateHolidays,
  umAlQuraYear,
} from "../../src/modules/terms/index.ts";
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
    permissions: ["indicators.view.college", "announcements.publish"],
  },
  {
    key: "vice-dean",
    labels: { ar: "وكيل التدريب" },
    permissions: [
      "term.manage",
      "framework.publish",
      "rayat.import",
      "indicators.view.college",
      "announcements.publish",
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
      "accounts.resetPassword",
      "accounts.linkEmployeeNumber",
      "announcements.publish",
    ],
  },
  { key: "secretary", labels: { ar: "أمين القسم" }, permissions: [] },
  { key: "trainer", labels: { ar: "المدرب" }, permissions: ["task.complete"] },
  { key: "quality-reviewer", labels: { ar: "مراجع الجودة" }, permissions: [] },
];

// The Eid breaks a college starts with (ADR-0018): each from the weekend nearest so many days before
// its Eid to the weekend nearest so many days after it, the averages of the Saudi calendars of 1443
// to 1448 (docs/reviews/eid-breaks.md), for this Umm al-Qura year and the nine after it. The
// vice-dean adjusts each year's on the terms page once its days are announced.
export const eidBreaks: (BreakRule & { key: string; name: string })[] = [
  {
    key: "eid-al-fitr",
    name: "إجازة عيد الفطر",
    month: 10,
    day: 1,
    before: 12,
    after: 5,
  },
  {
    key: "eid-al-adha",
    name: "إجازة عيد الأضحى",
    month: 12,
    day: 10,
    before: 7,
    after: 6,
  },
];
export const EID_BREAK_YEARS = 10;

// The Umm al-Qura years whose breaks a seed run on this day adds: this one and the nine after it.
export function breakYears(today = new Date().toISOString().slice(0, 10)) {
  const year = umAlQuraYear(today);
  return Array.from({ length: EID_BREAK_YEARS }, (_, offset) => year + offset);
}

// Idempotent: inserts the one college only while none exists and never updates it, and each of its
// roles, with its keys, only while the college has no role with that key, so a re-run changes
// nothing and never undoes the grid; and the Eid breaks of the years ahead it does not have yet,
// leaving those it has, adjusted or not. Returns the id of the first college, the one db:seed made.
export async function seedBase(
  db: Db,
  college: { name: string; shortName: string },
) {
  const collegeId = await db.transaction(async (tx) => {
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
  // After the transaction: the estimate reads the college's weekend from its settings.
  await estimateHolidays(collegeId, eidBreaks, breakYears(), db);
  return collegeId;
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
