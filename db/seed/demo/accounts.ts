import { symmetricEncrypt } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { joinRole } from "../../../src/modules/access/index.ts";
import {
  createAccount,
  twoFactors,
  users,
} from "../../../src/modules/identity/index.ts";
import { departments } from "../../../src/modules/org/index.ts";
import type { Db } from "../../../src/platform/db/client.ts";
import { demoDepartments } from "./departments.ts";

// Synthetic accounts for demonstrations and the end-to-end tests. With APP_ENV=local their password
// and the admin's authenticator secret are the ones published here on purpose: seed:demo refuses
// production, and no real person signs in with them. A demo in staging, which a tunnel can reach,
// brings its own through DEMO_PASSWORD and DEMO_TOTP_SECRET (src/platform/config/env.ts).
export const DEMO_PASSWORD = "oasis-demo-password";

// The admin's authenticator secret as Better Auth keeps it before encrypting it; the setup page
// shows it base32-encoded. The end-to-end tests compute the admin's codes from it.
export const DEMO_TOTP_SECRET = "OasisDemoAdminAuthenticator2026x"; // gitleaks:allow

/** The demo accounts' password and the admin's authenticator secret where this runs. */
export function demoSecrets(env: Record<string, string | undefined>) {
  return {
    password: env.DEMO_PASSWORD ?? DEMO_PASSWORD,
    totpSecret: env.DEMO_TOTP_SECRET ?? DEMO_TOTP_SECRET,
  };
}

const DEMO_BACKUP_CODES = Array.from(
  { length: 10 },
  (_, index) => `demo${index}-oasis`,
);

type DemoAccount = {
  name: string;
  email: string;
  employeeNumber: string;
  // Holds the system role, with two-factor on.
  admin?: boolean;
  // Holds this default role in this demo department.
  role?: { key: string; department: string };
  // Invited: replaces the password at the first sign-in.
  invited?: boolean;
};

// The admin, and two trainers of two demo departments.
export const demoAccounts = {
  admin: {
    name: "هند القحطاني",
    email: "admin@oasis.example",
    employeeNumber: "100001",
    admin: true,
  },
  trainer: {
    name: "فهد الزهراني",
    email: "f.alzahrani@oasis.example",
    employeeNumber: "200001",
    role: { key: "trainer", department: demoDepartments[1].name },
  },
  invitedTrainer: {
    name: "ريم الشهري",
    email: "r.alshehri@oasis.example",
    employeeNumber: "200002",
    role: { key: "trainer", department: demoDepartments[2].name },
    invited: true,
  },
} satisfies Record<string, DemoAccount>;

// An account already present, found by its email, is left as it is, and a role it holds already is
// not given again, so a re-run changes nothing.
export async function seedDemoAccounts(
  { db }: { db: Db },
  collegeId: string,
  authSecret: string,
  secrets: ReturnType<typeof demoSecrets>,
) {
  for (const account of Object.values(demoAccounts) as DemoAccount[]) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, account.email));
    const userId = existing?.id ?? (await createDemoAccount(account));
    if (account.admin) {
      await joinRole({ userId, collegeId, role: { system: true } }, db);
    }
    if (account.role) {
      const [department] = await db
        .select({ id: departments.id })
        .from(departments)
        .where(
          and(
            eq(departments.collegeId, collegeId),
            eq(departments.name, account.role.department),
          ),
        );
      await joinRole(
        {
          userId,
          collegeId,
          role: { key: account.role.key },
          departmentId: department.id,
        },
        db,
      );
    }
  }

  async function createDemoAccount(account: DemoAccount) {
    return db.transaction(async (tx) => {
      const { userId } = await createAccount(
        {
          collegeId,
          name: account.name,
          email: account.email,
          employeeNumber: account.employeeNumber,
        },
        tx,
        secrets.password,
      );
      if (account.invited) {
        await tx
          .update(users)
          .set({ mustChangePassword: true })
          .where(eq(users.id, userId));
      }
      if (!account.admin) return userId;
      // As Better Auth's two-factor plugin stores them: encrypted with AUTH_SECRET.
      await tx.insert(twoFactors).values({
        userId,
        secret: await symmetricEncrypt({
          key: authSecret,
          data: secrets.totpSecret,
        }),
        backupCodes: await symmetricEncrypt({
          key: authSecret,
          data: JSON.stringify(DEMO_BACKUP_CODES),
        }),
      });
      await tx
        .update(users)
        .set({ twoFactorEnabled: true })
        .where(eq(users.id, userId));
      return userId;
    });
  }
}
