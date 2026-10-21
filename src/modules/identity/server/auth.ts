import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins/two-factor";
import { parseEnv } from "../../../platform/config/env.ts";
import { getDb } from "../../../platform/db/client.ts";
import { REMEMBERED_DEVICE_DAYS_MAX } from "../../settings/index.ts";
import {
  accounts,
  sessions,
  twoFactors,
  users,
  verifications,
} from "./schema.ts";

const DAY_SECONDS = 86_400;

// Better Auth runs only inside server actions and server components: its HTTP routes are not
// mounted, so every sign-in passes the lockout and the limits in sign-in.ts, and Next.js checks the
// origin of every server action. The college's settings (session hours, idle time, remembered
// days, password length) are applied around it, in viewer.ts and sign-in.ts.
function createAuth() {
  const env = parseEnv(process.env);
  return betterAuth({
    baseURL: env.APP_URL,
    secret: env.AUTH_SECRET,
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
        twoFactor: twoFactors,
      },
    }),
    // Accounts come from admins and admin:create, never from a sign-up form.
    emailAndPassword: { enabled: true, disableSignUp: true },
    user: {
      additionalFields: {
        mustChangePassword: {
          type: "boolean",
          required: false,
          defaultValue: false,
          input: false,
        },
      },
    },
    session: {
      // The longest the remembered-device setting allows; sessionEnd() applies the college's value.
      expiresIn: REMEMBERED_DEVICE_DAYS_MAX * DAY_SECONDS,
      // Lifetimes follow the settings, not a sliding refresh.
      disableSessionRefresh: true,
      // No defaults: when Better Auth replaces a session it copies these from the old one, and a
      // default would overwrite them.
      additionalFields: {
        remembered: { type: "boolean", required: false, input: false },
        lastSeenAt: { type: "date", required: false, input: false },
      },
    },
    // The issuer shown in authenticator apps is the platform's name, passed when two-factor is set up.
    plugins: [twoFactor(), nextCookies()],
    // The sign-in limits are per identifier and address (sign-in.ts); Better Auth's are per address.
    rateLimit: { enabled: false },
    // The platform may run on an isolated network: nothing is sent out.
    telemetry: { enabled: false },
    advanced: {
      cookiePrefix: "college",
      // Host-only, HttpOnly and SameSite=Lax by default; Secure everywhere, localhost included.
      useSecureCookies: true,
      database: { generateId: false },
    },
  });
}

type Auth = ReturnType<typeof createAuth>;

// Created on first use, never at import: next build runs without the environment.
let shared: Auth | undefined;

export function getAuth() {
  shared ??= createAuth();
  return shared;
}
