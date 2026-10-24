import { randomInt, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Pool } from "pg";
import { joinRole } from "../../src/modules/access/index.ts";
import { createAccount } from "../../src/modules/identity/index.ts";
import { departments, findCollegeId } from "../../src/modules/org/index.ts";
import { createDb } from "../../src/platform/db/client.ts";
import { test as base } from "./test.ts";

export type TestAccount = {
  userId: string;
  name: string;
  email: string;
  employeeNumber: string;
  password: string;
};

type NewTestAccount = {
  /** Holds the system role, without two-factor set up yet. */
  admin?: boolean;
  /** Has a temporary password to replace at the first sign-in. */
  temporary?: boolean;
  /** A trainer in the department of this name. */
  trainerIn?: string;
};

// Deletes accounts a test made. A pass of the generation engine may be giving them tasks meanwhile,
// such as another test's quick request, and a task keeps its holder's account (lead review D): their
// roles go first, so no later pass reaches them, then their tasks and the accounts, again while a
// pass that was already running gives them one more. Sessions, credentials, two-factor and
// memberships go with each account; audit events stay.
export async function deleteAccounts(pool: Pool, userIds: readonly string[]) {
  if (userIds.length === 0) return;
  await pool.query("delete from memberships where user_id = any($1)", [
    userIds,
  ]);
  for (let tries = 1; ; tries += 1) {
    await pool.query("delete from tasks where holder_id = any($1)", [userIds]);
    try {
      await pool.query("delete from users where id = any($1)", [userIds]);
      return;
    } catch (error) {
      if (tries === 5 || (error as { code?: string }).code !== "23001") {
        throw error;
      }
    }
  }
}

// Accounts made for one test and removed after it, in the database the server under test uses,
// so a test that locks an account or changes a password never touches the demo accounts.
export const test = base.extend<{
  account: (options?: NewTestAccount) => Promise<TestAccount>;
}>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright reads the fixture's dependencies from this pattern
  account: async ({}, use) => {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("e2e: DATABASE_URL is not set (see .env.local)");
    const { db, pool } = createDb(url);
    const created: string[] = [];
    await use(async ({ admin = false, temporary = false, trainerIn } = {}) => {
      const collegeId = await findCollegeId(db);
      if (!collegeId) throw new Error("e2e: run pnpm seed:demo first");
      const employeeNumber = String(randomInt(900_000_000, 999_999_999));
      const account = {
        collegeId,
        name: `E2E ${employeeNumber}`,
        email: `e2e.${employeeNumber}@oasis.example`,
        employeeNumber,
      };
      const result = await db.transaction(async (tx) => {
        const made = await createAccount(
          account,
          tx,
          temporary ? undefined : `e2e-${randomUUID()}`,
        );
        if (admin) {
          await joinRole(
            { userId: made.userId, collegeId, role: { system: true } },
            tx,
          );
        }
        if (trainerIn) {
          const [department] = await tx
            .select({ id: departments.id })
            .from(departments)
            .where(
              and(
                eq(departments.collegeId, collegeId),
                eq(departments.name, trainerIn),
              ),
            );
          await joinRole(
            {
              userId: made.userId,
              collegeId,
              role: { key: "trainer" },
              departmentId: department.id,
            },
            tx,
          );
        }
        return made;
      });
      created.push(result.userId);
      return { ...account, ...result };
    });
    await deleteAccounts(pool, created);
    await pool.end();
  },
});

export { expect } from "./test.ts";
