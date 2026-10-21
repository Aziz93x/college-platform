import { symmetricEncrypt } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { memberships, roles } from "../../../src/modules/access/index.ts";
import {
  createAccount,
  twoFactors,
  users,
} from "../../../src/modules/identity/index.ts";
import type { Db } from "../../../src/platform/db/client.ts";

// Synthetic accounts for demonstrations and the end-to-end tests. Their password and the admin's
// authenticator secret are published here on purpose: seed:demo refuses production, and no real
// person signs in with them.
export const DEMO_PASSWORD = "oasis-demo-password";

// The admin's authenticator secret as Better Auth keeps it before encrypting it; the setup page
// shows it base32-encoded. The end-to-end tests compute the admin's codes from it.
export const DEMO_TOTP_SECRET = "OasisDemoAdminAuthenticator2026x"; // gitleaks:allow

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
  // Invited: replaces the password at the first sign-in.
  invited?: boolean;
};

// Trainers hold no role until Step 9 adds the roles; signed in, they reach the shell.
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
  },
  invitedTrainer: {
    name: "ريم الشهري",
    email: "r.alshehri@oasis.example",
    employeeNumber: "200002",
    invited: true,
  },
} satisfies Record<string, DemoAccount>;

// An account already present, found by its email, is left as it is, so a re-run changes nothing.
export async function seedDemoAccounts(
  { db }: { db: Db },
  collegeId: string,
  authSecret: string,
) {
  for (const account of Object.values(demoAccounts) as DemoAccount[]) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, account.email));
    if (existing) continue;
    await db.transaction(async (tx) => {
      const { userId } = await createAccount(
        {
          collegeId,
          name: account.name,
          email: account.email,
          employeeNumber: account.employeeNumber,
        },
        tx,
        DEMO_PASSWORD,
      );
      if (account.invited) {
        await tx
          .update(users)
          .set({ mustChangePassword: true })
          .where(eq(users.id, userId));
      }
      if (!account.admin) return;
      const [systemRole] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(and(eq(roles.collegeId, collegeId), eq(roles.system, true)));
      await tx
        .insert(memberships)
        .values({ userId, roleId: systemRole.id, collegeId });
      // As Better Auth's two-factor plugin stores them: encrypted with AUTH_SECRET.
      await tx.insert(twoFactors).values({
        userId,
        secret: await symmetricEncrypt({
          key: authSecret,
          data: DEMO_TOTP_SECRET,
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
    });
  }
}
