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
  SMTP_URL: z.url({ protocol: /^smtps?$/ }),
  // Signs session cookies and encrypts stored two-factor secrets. Changing it signs everyone out
  // and makes the stored two-factor secrets unreadable.
  AUTH_SECRET: z.string().min(32),
});

// The base seed also needs the placeholder college values.
const seedSchema = schema.extend({
  SEED_COLLEGE_NAME: z.string().trim().min(1),
  SEED_COLLEGE_SHORT_NAME: z.string().trim().min(1),
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
