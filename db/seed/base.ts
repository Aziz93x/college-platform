import { sql } from "drizzle-orm";
import { roles } from "../../src/modules/access/index.ts";
import { colleges } from "../../src/modules/org/index.ts";
import { parseSeedEnv } from "../../src/platform/config/env.ts";
import { createDb, type Db } from "../../src/platform/db/client.ts";

// The role that holds every permission. pnpm admin:create makes its first member.
export const systemRole = {
  key: "system-admin",
  labels: { ar: "مدير النظام" },
};

// Idempotent: inserts the one college only while none exists and never updates it, and its system
// role only while it has none, so a re-run changes nothing. Returns the id of the first college,
// the one db:seed made.
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
