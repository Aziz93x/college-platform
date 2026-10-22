import { parseArgs } from "node:util";
import { z } from "zod";
import { parseDemoEnv } from "../../src/platform/config/env.ts";
import { createDb } from "../../src/platform/db/client.ts";
import { seedBase } from "./base.ts";
import { demoSecrets, seedDemoAccounts } from "./demo/accounts.ts";
import { seedDemoAnnouncements } from "./demo/announcements.ts";
import { demoCollege, seedDemoCollege } from "./demo/college.ts";
import { seedDemoDepartments } from "./demo/departments.ts";
import { seedDemoFramework } from "./demo/framework.ts";
import { seedDemoHistory } from "./demo/history.ts";
import { seedDemoNotifications } from "./demo/notifications.ts";
import { createRandom } from "./demo/random.ts";
import { seedDemoRayat } from "./demo/rayat.ts";
import { seedDemoSections } from "./demo/sections.ts";
import { seedDemoSettings } from "./demo/settings.ts";
import { seedDemoTemplates } from "./demo/templates.ts";
import { DEMO_TERM_WEEKS, seedDemoTerms } from "./demo/terms.ts";

const MAX_SEED = 2 ** 32 - 1;

// The demo college: the same --seed builds the same data, a re-run adds nothing,
// and it refuses to run in production. Every later step extends it.
try {
  const env = parseDemoEnv(process.env);
  if (env.APP_ENV === "production") {
    console.error("seed:demo refuses to run when APP_ENV=production");
    process.exit(1);
  }

  const { values } = parseArgs({
    options: {
      seed: { type: "string", default: "42" },
      // The week of the demo term today falls in (Step 13).
      week: { type: "string", default: "9" },
    },
  });
  // Digits only: Number() would also read "", "0x10" and "1e3". The generator keeps 32 bits,
  // so a larger seed would build the same data as a smaller one.
  const parsedSeed = z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().max(MAX_SEED))
    .safeParse(values.seed);
  if (!parsedSeed.success) {
    console.error(
      `seed:demo: --seed must be a whole number from 0 to ${MAX_SEED}, got "${values.seed}"`,
    );
    process.exit(1);
  }
  const seed = parsedSeed.data;
  const parsedWeek = z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().min(1).max(DEMO_TERM_WEEKS))
    .safeParse(values.week);
  if (!parsedWeek.success) {
    console.error(
      `seed:demo: --week must be a week of the term, 1 to ${DEMO_TERM_WEEKS}, got "${values.week}"`,
    );
    process.exit(1);
  }
  const week = parsedWeek.data;

  const { db, pool } = createDb(env.DATABASE_URL);
  try {
    const ctx = { db, random: createRandom(seed) };
    const collegeId = await seedBase(db, demoCollege);
    await seedDemoCollege(ctx, collegeId);
    await seedDemoDepartments(ctx, collegeId);
    await seedDemoSettings(ctx, collegeId);
    await seedDemoAccounts(ctx, collegeId, env.AUTH_SECRET, demoSecrets(env));
    await seedDemoHistory(ctx, collegeId);
    await seedDemoNotifications(ctx, collegeId);
    await seedDemoAnnouncements(ctx, collegeId);
    await seedDemoTerms(ctx, collegeId, week);
    await seedDemoFramework(ctx, collegeId);
    const rayat = await seedDemoRayat(ctx, collegeId);
    await seedDemoSections(ctx, collegeId, week, rayat?.newerSs01);
    await seedDemoTemplates(ctx, collegeId);
    console.log(
      `seed:demo finished with --seed ${seed} --week ${week}: college ${collegeId}.`,
    );
  } finally {
    await pool.end();
  }
} catch (error) {
  // Drizzle wraps driver errors, such as a refused connection, in a "Failed query" error.
  const { message, cause } = error as Error;
  console.error(
    `seed:demo failed: ${message}`,
    cause instanceof Error ? cause.message : "",
  );
  process.exit(1);
}
