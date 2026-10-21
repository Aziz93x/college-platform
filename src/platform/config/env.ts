import { z } from "zod";

// Every environment variable the app and the worker read. Add new ones here, never read process.env elsewhere.
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  // Where this deployment runs. A missing value fails safe: production refuses the demo seed.
  APP_ENV: z.enum(["local", "staging", "production"]).default("production"),
  APP_URL: z.url({ protocol: /^https?$/ }),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  // Signs session cookies and encrypts stored two-factor secrets. Changing it signs everyone out
  // and makes the stored two-factor secrets unreadable.
  AUTH_SECRET: z.string().min(32),
});

// The base seed also needs the placeholder college values.
const seedSchema = schema.extend({
  SEED_COLLEGE_NAME: z.string().trim().min(1),
  SEED_COLLEGE_SHORT_NAME: z.string().trim().min(1),
});

// Migrations run as the tables' owner (DATABASE_URL); given the app's own URL, they also grant its
// role the rights it needs (db/migrate.ts).
const migrateSchema = schema.extend({
  APP_DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }).optional(),
});

// seed:demo's accounts sign in with a password and an authenticator secret that db/seed/demo/
// accounts.ts publishes for APP_ENV=local. A demo elsewhere, which a tunnel can reach (pnpm local:up
// --demo), brings its own (Audit 2, minor 10).
const demoSchema = schema
  .extend({
    DEMO_PASSWORD: z.string().min(16).optional(),
    DEMO_TOTP_SECRET: z.string().min(16).optional(),
  })
  .superRefine((env, context) => {
    if (env.APP_ENV !== "staging") return;
    for (const key of ["DEMO_PASSWORD", "DEMO_TOTP_SECRET"] as const) {
      if (!env[key]) {
        context.addIssue({
          code: "custom",
          path: [key],
          message: "required when APP_ENV=staging",
        });
      }
    }
  });

export type Env = z.infer<typeof schema>;

function parseWith<T extends z.ZodType>(
  target: T,
  source: Record<string, string | undefined>,
): z.infer<T> {
  const result = target.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `  ${issue.path.join(".")}: ${issue.message}`,
    );
    throw new Error(`Invalid environment variables:\n${problems.join("\n")}`);
  }
  return result.data;
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  return parseWith(schema, source);
}

export function parseSeedEnv(source: Record<string, string | undefined>) {
  return parseWith(seedSchema, source);
}

export function parseMigrateEnv(source: Record<string, string | undefined>) {
  return parseWith(migrateSchema, source);
}

export function parseDemoEnv(source: Record<string, string | undefined>) {
  return parseWith(demoSchema, source);
}
