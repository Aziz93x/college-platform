import { randomInt, randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { joinRole } from "../../src/modules/access/index.ts";
import { createAccount, users } from "../../src/modules/identity/index.ts";
import { findCollegeId } from "../../src/modules/org/index.ts";
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
};

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
    await use(async ({ admin = false, temporary = false } = {}) => {
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
        return made;
      });
      created.push(result.userId);
      return { ...account, ...result };
    });
    // Sessions, credentials, two-factor and memberships go with the user; audit events stay.
    if (created.length > 0) {
      await db.delete(users).where(inArray(users.id, created));
    }
    await pool.end();
  },
});

export { expect } from "./test.ts";
