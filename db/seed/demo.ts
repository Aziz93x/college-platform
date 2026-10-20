import { parseArgs } from "node:util";
import { z } from "zod";
import { parseEnv } from "../../src/platform/config/env.ts";
import { createDb } from "../../src/platform/db/client.ts";
import { seedBase } from "./base.ts";
import { demoCollege, seedDemoCollege } from "./demo/college.ts";
import { createRandom } from "./demo/random.ts";
import { seedDemoSettings } from "./demo/settings.ts";

const MAX_SEED = 2 ** 32 - 1;

// The demo college: the same --seed builds the same data, a re-run adds nothing,
// and it refuses to run in production. Every later step extends it.
try {
  const env = parseEnv(process.env);
  if (env.APP_ENV === "production") {
    console.error("seed:demo refuses to run when APP_ENV=production");
    process.exit(1);
  }

  const { values } = parseArgs({
    options: { seed: { type: "string", default: "42" } },
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

  const { db, pool } = createDb(env.DATABASE_URL);
  try {
    const ctx = { db, random: createRandom(seed) };
    const collegeId = await seedBase(db, demoCollege);
    await seedDemoCollege(ctx, collegeId);
    await seedDemoSettings(ctx, collegeId);
    console.log(
      `seed:demo finished with --seed ${seed}: college ${collegeId}.`,
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
