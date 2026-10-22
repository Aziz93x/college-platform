import { sql } from "drizzle-orm";
import {
  type PermissionKey,
  rolePermissions,
  roles,
} from "../../src/modules/access/index.ts";
import { type AxisCatalog, seedAxes } from "../../src/modules/axes/index.ts";
import { colleges } from "../../src/modules/org/index.ts";
import { settings } from "../../src/modules/settings/index.ts";
import {
  type BreakRule,
  estimateHolidays,
  umAlQuraYear,
} from "../../src/modules/terms/index.ts";
import { parseSeedEnv } from "../../src/platform/config/env.ts";
import { createDb, type Db } from "../../src/platform/db/client.ts";
import { rayatColumns } from "./rayat-columns.ts";

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
    permissions: [
      "indicators.view.college",
      "announcements.publish",
      "framework.endorse",
    ],
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

// The holidays a college starts with (ADR-0018), for this Umm al-Qura year and the nine after it:
// each Eid break from the weekend nearest so many days before its Eid to the weekend nearest so
// many days after it, the averages of the Saudi calendars of 1443 to 1448
// (docs/reviews/eid-breaks.md), the Eid al-Fitr break starting in Ramadan; and Founding Day. The
// vice-dean approves each year's or adjusts it on the terms page once its days are announced.
export const holidayRules: (BreakRule & { key: string; name: string })[] = [
  {
    key: "eid-al-fitr",
    name: "إجازة رمضان وعيد الفطر",
    calendar: "umalqura",
    month: 10,
    day: 1,
    before: 12,
    after: 5,
  },
  {
    key: "eid-al-adha",
    name: "إجازة عيد الأضحى",
    calendar: "umalqura",
    month: 12,
    day: 10,
    before: 7,
    after: 6,
  },
  {
    key: "founding-day",
    name: "إجازة يوم التأسيس",
    calendar: "gregory",
    month: 2,
    day: 22,
  },
];
export const HOLIDAY_YEARS = 10;

// The portfolio's axes as the administration numbers them, in three groups and the optional
// closing group (Step 14). Provisional until the owner gives the administration's list: the plan
// names axes 4 and 7 to 13, and the others are named after the work the plan files under them.
// The admin corrects a title on /axes.
export const portfolioAxes: AxisCatalog = [
  {
    code: "1",
    title: "المجموعة الأولى",
    axes: [
      { code: "1", title: "الخطط التدريبية" },
      { code: "2", title: "الاختبارات" },
      { code: "3", title: "تحليل نتائج الاختبارات" },
    ],
  },
  {
    code: "2",
    title: "المجموعة الثانية",
    axes: [
      { code: "4", title: "الملف المهني" },
      { code: "5", title: "الواجبات" },
      { code: "6", title: "الممارسات التدريبية" },
      { code: "7", title: "التدريب الإلكتروني" },
      { code: "8", title: "الإرشاد التدريبي" },
    ],
  },
  {
    code: "3",
    title: "المجموعة الثالثة",
    axes: [
      { code: "9", title: "التكليفات" },
      { code: "10", title: "المبادرات والمشاركات" },
      { code: "11", title: "المؤشرات" },
    ],
  },
  {
    code: "closing",
    title: "الخاتمة",
    axes: [
      { code: "12", title: "الخاتمة" },
      { code: "13", title: "التطلعات" },
    ],
  },
];

// The Umm al-Qura years whose holidays a seed run on this day adds: this one and the nine after it.
export function holidayYears(today = new Date().toISOString().slice(0, 10)) {
  const year = umAlQuraYear(today);
  return Array.from({ length: HOLIDAY_YEARS }, (_, offset) => year + offset);
}

// Idempotent: inserts the one college only while none exists and never updates it, and each of its
// roles, with its keys, only while the college has no role with that key, so a re-run changes
// nothing and never undoes the grid; Rayat's column maps while the college has none, leaving those
// an admin changed; and the holidays of the years ahead it does not have yet, leaving those it has,
// adjusted or not; and the portfolio's axes it does not have yet. Returns the id of the first
// college, the one db:seed made.
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
    await tx
      .insert(settings)
      .values(
        Object.entries(rayatColumns).map(([kind, value]) => ({
          collegeId: row.id,
          key: `rayat.columns.${kind}`,
          value,
        })),
      )
      .onConflictDoNothing();
    return row.id;
  });
  // After the transaction: the estimate reads the college's weekend from its settings.
  await estimateHolidays(collegeId, holidayRules, holidayYears(), db);
  await seedAxes(collegeId, portfolioAxes, db);
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
