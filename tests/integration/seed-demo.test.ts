import { randomBytes } from "node:crypto";
import { symmetricDecrypt, verifyPassword } from "better-auth/crypto";
import type { Pool } from "pg";
import { afterAll, expect, it } from "vitest";
import {
  DEMO_PASSWORD,
  DEMO_TOTP_SECRET,
  demoAccounts,
} from "../../db/seed/demo/accounts.ts";
import { demoCollege } from "../../db/seed/demo/college.ts";
import { demoDepartments } from "../../db/seed/demo/departments.ts";
import { demoSettings } from "../../db/seed/demo/settings.ts";
import {
  createTestDatabase,
  runScript,
  scriptEnv,
} from "./support/database.ts";
import { tableRows } from "./support/rows.ts";

const databases: Awaited<ReturnType<typeof createTestDatabase>>[] = [];

async function freshDatabase() {
  const database = await createTestDatabase();
  databases.push(database);
  return database;
}

afterAll(() => Promise.all(databases.map((database) => database.drop())));

const seedDemo = (args: string[], env: NodeJS.ProcessEnv) =>
  runScript("db/seed/demo.ts", args, env);

async function seedDemoOk(url: string) {
  const result = await seedDemo(["--seed", "42"], scriptEnv(url));
  expect(result.code, result.stderr).toBe(0);
}

const collegeNames = async (pool: Pool) =>
  (await pool.query("select name, short_name from colleges")).rows;

const theDemoCollege = [
  { name: demoCollege.name, short_name: demoCollege.shortName },
];

it("gives db:seed's college the demo values, settings and departments, then a second run changes no row", async () => {
  const { url, pool } = await freshDatabase();
  const base = await runScript("db/seed/base.ts", [], scriptEnv(url));
  expect(base.code, base.stderr).toBe(0);

  await seedDemoOk(url);
  const first = await tableRows(pool);
  await seedDemoOk(url);

  expect(await tableRows(pool)).toEqual(first);
  expect(Object.keys(first)).toEqual(
    expect.arrayContaining([
      "public.audit_events",
      "public.colleges",
      "public.department_rayat_values",
      "public.departments",
      "public.settings",
      "public.users",
    ]),
  );
  expect(await collegeNames(pool)).toEqual(theDemoCollege);
  expect(
    (await pool.query("select key, value from settings order by key")).rows,
  ).toEqual(
    Object.entries(demoSettings)
      .sort(([a], [b]) => a.localeCompare(b, "en"))
      .map(([key, value]) => ({ key, value })),
  );
  const { rows: seeded } = await pool.query(`
    select d.name, d.short_name, d.active, array_agg(v.value order by v.value) as values
    from departments d join department_rayat_values v on v.department_id = d.id
    group by d.id order by d.name`);
  expect(seeded).toEqual(
    demoDepartments
      .map(({ name, shortName, rayatValues }) => ({
        name,
        short_name: shortName,
        active: true,
        values: [...rayatValues].sort(),
      }))
      .sort((a, b) => (a.name < b.name ? -1 : 1)),
  );
});

it("adds the demo accounts: an admin with the system role and two-factor, and a trainer and an invited trainer, each in their department", async () => {
  const { url, pool } = await freshDatabase();
  await seedDemoOk(url);

  const { rows } = await pool.query(`
    select u.email, p.employee_number, u.must_change_password, u.two_factor_enabled,
      a.password, r.key as role, d.name as department
    from users u
    join people p on p.user_id = u.id
    join accounts a on a.user_id = u.id and a.provider_id = 'credential'
    left join memberships m on m.user_id = u.id
    left join roles r on r.id = m.role_id
    left join departments d on d.id = m.department_id
    order by p.employee_number`);
  expect(rows.map(({ password: _hash, ...row }) => row)).toEqual([
    {
      email: demoAccounts.admin.email,
      employee_number: demoAccounts.admin.employeeNumber,
      must_change_password: false,
      two_factor_enabled: true,
      role: "system-admin",
      department: null,
    },
    {
      email: demoAccounts.trainer.email,
      employee_number: demoAccounts.trainer.employeeNumber,
      must_change_password: false,
      two_factor_enabled: false,
      role: "trainer",
      department: demoAccounts.trainer.role.department,
    },
    {
      email: demoAccounts.invitedTrainer.email,
      employee_number: demoAccounts.invitedTrainer.employeeNumber,
      must_change_password: true,
      two_factor_enabled: false,
      role: "trainer",
      department: demoAccounts.invitedTrainer.role.department,
    },
  ]);
  for (const { password } of rows) {
    expect(
      await verifyPassword({ hash: password, password: DEMO_PASSWORD }),
    ).toBe(true);
  }
  const { rows: secrets } = await pool.query("select secret from two_factors");
  expect(
    await Promise.all(
      secrets.map(({ secret }) =>
        symmetricDecrypt({
          key: scriptEnv(url).AUTH_SECRET ?? "",
          data: secret,
        }),
      ),
    ),
  ).toEqual([DEMO_TOTP_SECRET]);
});

it("builds the same rows from the same seed on two fresh databases", async () => {
  const [one, two] = await Promise.all([freshDatabase(), freshDatabase()]);
  await seedDemoOk(one.url);
  await seedDemoOk(two.url);

  // Ids and timestamps, and what is salted or encrypted with a random nonce, differ by design.
  const generated = [
    "id",
    "college_id",
    "user_id",
    "role_id",
    "account_id",
    "department_id",
    "created_at",
    "updated_at",
    "password",
    "secret",
    "backup_codes",
  ];
  expect(await tableRows(two.pool, generated)).toEqual(
    await tableRows(one.pool, generated),
  );
  expect(await collegeNames(one.pool)).toEqual(theDemoCollege);
});

it("refuses to run when APP_ENV is production or unset, and writes nothing", async () => {
  const { url, pool } = await freshDatabase();
  const { APP_ENV: _unset, ...withoutAppEnv } = scriptEnv(url);

  for (const env of [
    scriptEnv(url, { APP_ENV: "production" }),
    withoutAppEnv,
  ]) {
    const result = await seedDemo([], env);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain(
      "seed:demo refuses to run when APP_ENV=production",
    );
  }
  expect(await collegeNames(pool)).toEqual([]);
});

it("in staging, signs the accounts in with the environment's own demo secrets, and needs them", async () => {
  const { url, pool } = await freshDatabase();
  const staging = scriptEnv(url, { APP_ENV: "staging" });

  const refused = await seedDemo([], staging);
  expect(refused.code).toBe(1);
  expect(refused.stderr).toContain(
    "DEMO_PASSWORD: required when APP_ENV=staging",
  );
  expect(refused.stderr).toContain(
    "DEMO_TOTP_SECRET: required when APP_ENV=staging",
  );
  expect(await collegeNames(pool)).toEqual([]);

  const secrets = {
    DEMO_PASSWORD: randomBytes(12).toString("base64url"),
    DEMO_TOTP_SECRET: randomBytes(24).toString("base64url"),
  };
  const seeded = await seedDemo([], { ...staging, ...secrets });
  expect(seeded.code, seeded.stderr).toBe(0);
  const { rows } = await pool.query(
    "select password from accounts where provider_id = 'credential'",
  );
  expect(rows).toHaveLength(3);
  for (const { password } of rows) {
    expect(
      await verifyPassword({ hash: password, password: secrets.DEMO_PASSWORD }),
    ).toBe(true);
  }
  const [{ secret }] = (await pool.query("select secret from two_factors"))
    .rows;
  expect(
    await symmetricDecrypt({ key: staging.AUTH_SECRET ?? "", data: secret }),
  ).toBe(secrets.DEMO_TOTP_SECRET);
});

it("exits 1 when --seed is not a whole number from 0 to 2^32 - 1", async () => {
  const { url, pool } = await freshDatabase();

  for (const value of ["abc", "-1", "1.5", "", "0x10", "1e3", "4294967296"]) {
    const result = await seedDemo([`--seed=${value}`], scriptEnv(url));
    expect(result.code, value).toBe(1);
    expect(result.stderr).toContain("--seed must be a whole number");
  }
  expect(await collegeNames(pool)).toEqual([]);
});
