import { parseArgs } from "node:util";
import { z } from "zod";
import { createFirstAdmin } from "../src/modules/access/index.ts";
import { findCollegeId } from "../src/modules/org/index.ts";
import { parseEnv } from "../src/platform/config/env.ts";
import { createDb } from "../src/platform/db/client.ts";
import { latinDigits } from "../src/platform/validation/digits.ts";

// pnpm admin:create --name "<full name>" --email <email> --employee-number <number>
// Creates the college's first admin and prints their temporary password, once. Refuses once the
// college has an admin: every later account comes from the admins.
const USAGE =
  'usage: pnpm admin:create --name "<full name>" --email <email> --employee-number <number>';

const options = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email(),
  "employee-number": latinDigits(
    z
      .string()
      .trim()
      .regex(/^\d{1,20}$/),
  ),
});

try {
  const env = parseEnv(process.env);
  const { values } = parseArgs({
    options: {
      name: { type: "string" },
      email: { type: "string" },
      "employee-number": { type: "string" },
    },
  });
  const parsed = options.safeParse(values);
  if (!parsed.success) {
    const problems = parsed.error.issues.map(
      (issue) => `  --${issue.path.join(".")}: ${issue.message}`,
    );
    console.error(`admin:create: invalid options\n${problems.join("\n")}`);
    console.error(USAGE);
    process.exit(1);
  }

  const { db, pool } = createDb(env.DATABASE_URL);
  try {
    const collegeId = await findCollegeId(db);
    const result = collegeId
      ? await createFirstAdmin(
          {
            collegeId,
            name: parsed.data.name,
            email: parsed.data.email,
            employeeNumber: parsed.data["employee-number"],
          },
          db,
        )
      : { status: "noSystemRole" as const };
    if (result.status === "noSystemRole") {
      console.error("admin:create: no college yet; run pnpm db:seed first.");
      process.exitCode = 1;
    } else if (result.status === "adminExists") {
      console.error(
        "admin:create refuses: the college has an admin already. An admin creates every other account.",
      );
      process.exitCode = 1;
    } else {
      console.log(
        [
          `Admin created: ${parsed.data.email} (employee number ${parsed.data["employee-number"]}).`,
          `Temporary password, shown only now: ${result.password}`,
          "Sign in with it, then choose a new password and set up two-factor authentication.",
        ].join("\n"),
      );
    }
  } finally {
    await pool.end();
  }
} catch (error) {
  // Drizzle wraps driver errors, such as a refused connection or a taken email, in a "Failed query"
  // error whose message lists the query's values; only the driver's reason is printed.
  const { message, cause } = error as Error;
  console.error(
    `admin:create failed: ${cause instanceof Error ? cause.message : message}`,
  );
  process.exit(1);
}
