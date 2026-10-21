import { symmetricEncrypt } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import {
  joinRole,
  permissionKeys,
  requiresTwoFactor,
} from "../../../src/modules/access/index.ts";
import {
  createAccount,
  twoFactors,
  users,
} from "../../../src/modules/identity/index.ts";
import { departments } from "../../../src/modules/org/index.ts";
import type { Db } from "../../../src/platform/db/client.ts";
import { defaultRoles } from "../base.ts";
import { demoDepartments } from "./departments.ts";
import { type DemoAccount, type DemoRole, demoCast } from "./people.ts";

// Synthetic accounts for demonstrations and the end-to-end tests. With APP_ENV=local their password
// and second factor are the ones published here on purpose: seed:demo refuses production, and no
// real person signs in with them. A demo in staging, which a tunnel can reach, brings its own
// through DEMO_PASSWORD, DEMO_ADMIN_PASSWORD, DEMO_TOTP_SECRET, DEMO_BACKUP_CODES and
// DEMO_HEAD_BACKUP_CODES (src/platform/config/env.ts): there the admin has a password and backup
// codes of its own, so what testers are given, a trainer's password or a head's codes, never opens
// the admin's account (Audit 3).
export const DEMO_PASSWORD = "oasis-demo-password";

// The authenticator secret of the accounts with two-factor, the admin's and the heads', as Better
// Auth keeps it before encrypting it; the setup page shows it base32-encoded. The end-to-end tests
// compute their codes from it.
export const DEMO_TOTP_SECRET = "OasisDemoAdminAuthenticator2026x"; // gitleaks:allow

const backupCodes = (prefix: string) =>
  Array.from({ length: 10 }, (_, index) => `${prefix}${index}-oasis`);

/** The demo accounts' passwords and second factor where this runs. */
export function demoSecrets(env: Record<string, string | undefined>) {
  return {
    password: env.DEMO_PASSWORD ?? DEMO_PASSWORD,
    adminPassword: env.DEMO_ADMIN_PASSWORD ?? DEMO_PASSWORD,
    totpSecret: env.DEMO_TOTP_SECRET ?? DEMO_TOTP_SECRET,
    backupCodes: env.DEMO_BACKUP_CODES?.split(",") ?? backupCodes("demo"),
    headBackupCodes:
      env.DEMO_HEAD_BACKUP_CODES?.split(",") ?? backupCodes("head"),
  };
}

const [generalStudies, electrical, mechanical] = demoDepartments.map(
  ({ name }) => name,
);

// The people the tests and the guides name; demoCast() adds the rest of Step 43's cast.
export const demoAccounts = {
  admin: {
    name: "هند القحطاني",
    email: "admin@oasis.example",
    employeeNumber: "100001",
    roles: [{ system: true }],
  },
  dean: {
    name: "عبدالرحمن العتيبي",
    email: "a.alotaibi@oasis.example",
    employeeNumber: "100002",
    roles: [{ key: "dean" }],
  },
  viceDean: {
    name: "سلمان الغامدي",
    email: "s.alghamdi@oasis.example",
    employeeNumber: "100003",
    roles: [{ key: "vice-dean" }],
  },
  qualityReviewer: {
    name: "نوف الحربي",
    email: "n.alharbi@oasis.example",
    employeeNumber: "100004",
    roles: [{ key: "quality-reviewer" }],
  },
  head: {
    name: "ماجد الدوسري",
    email: "m.aldosari@oasis.example",
    employeeNumber: "110002",
    roles: [{ key: "head", department: electrical }],
  },
  trainer: {
    name: "فهد الزهراني",
    email: "f.alzahrani@oasis.example",
    employeeNumber: "200001",
    roles: [{ key: "trainer", department: electrical }],
  },
  invitedTrainer: {
    name: "ريم الشهري",
    email: "r.alshehri@oasis.example",
    employeeNumber: "200002",
    roles: [{ key: "trainer", department: mechanical }],
    invited: true,
  },
  disabledTrainer: {
    name: "بدر المطيري",
    email: "b.almutairi@oasis.example",
    employeeNumber: "200003",
    roles: [{ key: "trainer", department: generalStudies }],
    disabled: true,
  },
} satisfies Record<string, DemoAccount>;

// The keys a demo role holds on the default grid.
const keysOf = (role: DemoRole) =>
  "system" in role
    ? permissionKeys
    : (defaultRoles.find(({ key }) => key === role.key)?.permissions ?? []);

// An account already present, found by its email, is left as it is, and a role it holds already is
// not given again, so a re-run changes nothing.
export async function seedDemoAccounts(
  { db, random }: { db: Db; random: () => number },
  collegeId: string,
  authSecret: string,
  secrets: ReturnType<typeof demoSecrets>,
) {
  const named = Object.values(demoAccounts) as DemoAccount[];
  const cast = demoCast(
    random,
    named.map(({ name }) => name),
  );
  const departmentIds = new Map(
    (
      await db
        .select({ id: departments.id, name: departments.name })
        .from(departments)
        .where(eq(departments.collegeId, collegeId))
    ).map(({ id, name }) => [name, id]),
  );
  // Never across the college for want of the department.
  const departmentId = (name: string) => {
    const id = departmentIds.get(name);
    if (!id) throw new Error(`seed:demo: no department named ${name}`);
    return id;
  };
  for (const account of [...named, ...cast]) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, account.email));
    const userId = existing?.id ?? (await createDemoAccount(account));
    for (const role of account.roles) {
      await joinRole(
        "system" in role
          ? { userId, collegeId, role }
          : {
              userId,
              collegeId,
              role: { key: role.key },
              departmentId: role.department
                ? departmentId(role.department)
                : null,
            },
        db,
      );
    }
  }

  async function createDemoAccount(account: DemoAccount) {
    const admin = account.roles.some((role) => "system" in role);
    return db.transaction(async (tx) => {
      const { userId } = await createAccount(
        {
          collegeId,
          name: account.name,
          email: account.email,
          employeeNumber: account.employeeNumber,
        },
        tx,
        admin ? secrets.adminPassword : secrets.password,
      );
      await tx
        .update(users)
        .set({
          mustChangePassword: account.invited ?? false,
          disabledAt: account.disabled ? new Date() : null,
        })
        .where(eq(users.id, userId));
      // A key that acts on other people's accounts requires two-factor of its holder (Step 6): set
      // up here as Better Auth's two-factor plugin stores it, encrypted with AUTH_SECRET.
      if (!requiresTwoFactor(account.roles.flatMap(keysOf))) return userId;
      await tx.insert(twoFactors).values({
        userId,
        secret: await symmetricEncrypt({
          key: authSecret,
          data: secrets.totpSecret,
        }),
        backupCodes: await symmetricEncrypt({
          key: authSecret,
          data: JSON.stringify(
            admin ? secrets.backupCodes : secrets.headBackupCodes,
          ),
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
