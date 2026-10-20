import { z } from "zod";

// Every environment variable the app and the worker read. Add new ones here, never read process.env elsewhere.
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_URL: z.url({ protocol: /^https?$/ }),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  SMTP_URL: z.url({ protocol: /^smtps?$/ }),
});

export type Env = z.infer<typeof schema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `  ${issue.path.join(".")}: ${issue.message}`,
    );
    throw new Error(`Invalid environment variables:\n${problems.join("\n")}`);
  }
  return result.data;
}
