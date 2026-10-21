import { randomBytes } from "node:crypto";
import { symmetricDecrypt, verifyPassword } from "better-auth/crypto";
import type { Pool } from "pg";
import { afterAll, expect, it } from "vitest";
import {
  DEMO_PASSWORD,
  DEMO_TOTP_SECRET,
  demoAccounts,
  demoSecrets,
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

// A database the demo seed filled once, for the tests that only read it.
let seeded: ReturnType<typeof freshDatabase> | undefined;
function seededDatabase() {
  seeded ??= freshDatabase().then(async (database) => {
    await seedDemoOk(database.url);
    return database;
  });
  return seeded;
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

// Each demo person, by employee number, with their roles as "key" or "key:department".
const demoPeople = async (pool: Pool) =>
  (
    await pool.query(`
      select p.employee_number, u.name, u.email, a.password, u.must_change_password,
        u.disabled_at is not null as disabled, u.two_factor_enabled,
        array_agg(r.key || coalesce(':' || d.name, '') order by r.key) as roles
      from users u
      join people p on p.user_id = u.id
      join accounts a on a.user_id = u.id and a.provider_id = 'credential'
      join memberships m on m.user_id = u.id
      join roles r on r.id = m.role_id
      left join departments d on d.id = m.department_id
      group by p.employee_number, u.id, a.password
      order by p.employee_number`)
  ).rows;

const decrypt = (url: string, data: string) =>
  symmetricDecrypt({ key: scriptEnv(url).AUTH_SECRET ?? "", data });

it("adds Step 43's people: the admin, the dean, the vice-dean, a quality reviewer, a head per department and forty trainers, three of them secretaries", async () => {
  const { pool } = await seededDatabase();
  const people = await demoPeople(pool);

  expect(people).toHaveLength(47);
  for (const account of Object.values(demoAccounts)) {
    expect(
      people.find(
        ({ employee_number }) => employee_number === account.employeeNumber,
      ),
    ).toMatchObject({
      name: account.name,
      email: account.email,
      must_change_password: "invited" in account,
      disabled: "disabled" in account,
      roles: account.roles.map((role) =>
        "system" in role
          ? "system-admin"
          : [role.key, ...("department" in role ? [role.department] : [])].join(
              ":",
            ),
      ),
    });
  }
  const holding = (role: string) =>
    people.filter(({ roles }) => roles.includes(role)).length;
  for (const role of [
    "system-admin",
    "dean",
    "vice-dean",
    "quality-reviewer",
  ]) {
    expect(holding(role), role).toBe(1);
  }
  for (const { name } of demoDepartments) {
    expect(holding(`head:${name}`), name).toBe(1);
    // The secretary is one of the department's trainers.
    expect(
      people.filter(
        ({ roles }) =>
          roles.includes(`secretary:${name}`) &&
          roles.includes(`trainer:${name}`),
      ),
      name,
    ).toHaveLength(1);
  }
  expect(
    people.filter(({ roles }) =>
      roles.some((role: string) => role.startsWith("trainer:")),
    ),
  ).toHaveLength(40);

  // Synthetic Arabic names, none twice, and an email each.
  for (const { name } of people) {
    expect(name).toMatch(/^\p{Script=Arabic}+( \p{Script=Arabic}+)+$/u);
  }
  expect(new Set(people.map(({ name }) => name)).size).toBe(47);
  expect(new Set(people.map(({ email }) => email)).size).toBe(47);
  for (const { password } of people) {
    expect(
      await verifyPassword({ hash: password, password: DEMO_PASSWORD }),
    ).toBe(true);
  }
});

it("sets up two-factor for the holders of a key that requires it, the admin and the heads, each with their own backup codes", async () => {
  const { url, pool } = await seededDatabase();
  const people = await demoPeople(pool);

  expect(
    people
      .filter(({ two_factor_enabled }) => two_factor_enabled)
      .map(({ roles }) => roles[0].split(":")[0]),
  ).toEqual(["system-admin", "head", "head", "head"]);
  const { rows } = await pool.query(`
    select u.email, t.secret, t.backup_codes from two_factors t
    join users u on u.id = t.user_id`);
  const secrets = demoSecrets({});
  expect(rows).toHaveLength(4);
  for (const { email, secret, backup_codes } of rows) {
    expect(await decrypt(url, secret)).toBe(DEMO_TOTP_SECRET);
    expect(JSON.parse(await decrypt(url, backup_codes))).toEqual(
      email === demoAccounts.admin.email
        ? secrets.backupCodes
        : secrets.headBackupCodes,
    );
  }
  expect(
    secrets.headBackupCodes.filter((code) =>
      secrets.backupCodes.includes(code),
    ),
  ).toEqual([]);
});

it("builds the same rows from the same seed on two fresh databases", async () => {
  const [one, two] = await Promise.all([
    seededDatabase(),
    freshDatabase().then(async (database) => {
      await seedDemoOk(database.url);
      return database;
    }),
  ]);

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
    "disabled_at",
    "read_at",
  ];
  // The log names its records by their ids, in its columns and in what changed, so each id reads
  // the same there.
  const sameIds = async (pool: Pool) =>
    Object.fromEntries(
      Object.entries(await tableRows(pool, generated)).map(([table, rows]) => [
        table,
        rows.map((row) => row.replaceAll(UUID, "<id>")).sort(),
      ]),
    );
  expect(await sameIds(two.pool)).toEqual(await sameIds(one.pool));
  expect(await collegeNames(one.pool)).toEqual(theDemoCollege);
});

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

it("writes three weeks of the college's history, every event in the past and by one of its people, and a re-run adds none", async () => {
  const { pool } = await seededDatabase();
  const { rows } = await pool.query(`
    select e.action, e.created_at, e.actor_id, e.entity_type, e.entity_id, e.ip, e.user_agent,
      exists (select 1 from users u where u.id::text = e.actor_id) as actor_known
    from audit_events e order by e.created_at`);
  expect(rows.length).toBeGreaterThan(300);
  const now = Date.now();
  expect(rows[0].created_at.getTime()).toBeGreaterThan(now - 22 * 86_400_000);
  expect(rows.at(-1).created_at.getTime()).toBeLessThan(now);
  for (const row of rows) {
    // Only the system locks an account; every other event is a person's, from their device.
    expect(row.actor_known || row.action === "account.lock", row.action).toBe(
      true,
    );
    expect(row.ip).toMatch(/^10\.(20|40)\./);
    expect(row.user_agent).toMatch(/^Mozilla\/5\.0 /);
  }
  expect(new Set(rows.map(({ action }) => action))).toEqual(
    new Set([
      "setting.update",
      "department.create",
      "role.update",
      "account.create",
      "membership.create",
      "session.signIn",
      "session.signOut",
      "account.changePassword",
      "account.startTwoFactorSetup",
      "account.enableTwoFactor",
      "account.lock",
      "account.resetPassword",
      "person.linkEmployeeNumber",
      "person.update",
      "account.disable",
      "audit.export",
    ]),
  );
  // Every person was added, and the invited trainer has not signed in.
  const { rows: people } = await pool.query(`
    select p.employee_number,
      count(*) filter (where e.action = 'account.create') as created,
      count(*) filter (where e.action = 'session.signIn') as signed_in
    from people p left join audit_events e on e.entity_id = p.user_id::text
    group by p.employee_number`);
  for (const person of people) {
    if (person.employee_number === demoAccounts.admin.employeeNumber) continue;
    expect(Number(person.created), person.employee_number).toBe(1);
    expect(Number(person.signed_in) > 0, person.employee_number).toBe(
      person.employee_number !== demoAccounts.invitedTrainer.employeeNumber,
    );
  }
});

it("tells each role's holder when the log shows it given, and sends each week's digest of what it left unread, on Sunday at 7:00 in Riyadh", async () => {
  const { pool } = await seededDatabase();
  const { rows } = await pool.query(`
    select n.kind, n.user_id::text, n.params, n.once_key, n.created_at, n.read_at
    from notifications n order by n.created_at`);
  const { rows: given } = await pool.query(`
    select diff->'to'->>'userId' as user_id, created_at from audit_events
    where action = 'membership.create'`);
  const told = (list: { user_id: string; created_at: Date }[]) =>
    list
      .map(
        ({ user_id, created_at }) => `${user_id} ${created_at.toISOString()}`,
      )
      .sort();
  expect(told(rows.filter(({ kind }) => kind === "membershipAdded"))).toEqual(
    told(given),
  );

  const digests = rows.filter(({ kind }) => kind === "weeklyDigest");
  expect(digests.length).toBeGreaterThan(0);
  for (const digest of digests) {
    // Sunday at 7:00 in Riyadh is 4:00 UTC the same day.
    expect(digest.created_at.getUTCDay()).toBe(0);
    expect(digest.created_at.toISOString()).toMatch(/T04:00:00\.000Z$/);
    expect(digest.once_key).toBe(
      `weeklyDigest:${digest.created_at.toISOString().slice(0, 10)}`,
    );
    expect(digest.params.count).toBeGreaterThan(0);
    expect(digest.params.latest.length).toBeLessThanOrEqual(3);
  }
  // A notification is read after it came, and the invited trainer, who never signed in, read none.
  for (const row of rows) {
    if (row.read_at) expect(row.read_at > row.created_at).toBe(true);
  }
  const { rows: invited } = await pool.query(
    `select count(*) filter (where n.read_at is not null) as read, count(*) as told
     from notifications n join people p on p.user_id = n.user_id where p.employee_number = $1`,
    [demoAccounts.invitedTrainer.employeeNumber],
  );
  expect(Number(invited[0].told)).toBeGreaterThan(0);
  expect(Number(invited[0].read)).toBe(0);
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
  for (const key of [
    "DEMO_PASSWORD",
    "DEMO_ADMIN_PASSWORD",
    "DEMO_TOTP_SECRET",
    "DEMO_BACKUP_CODES",
    "DEMO_HEAD_BACKUP_CODES",
  ]) {
    expect(refused.stderr).toContain(`${key}: required when APP_ENV=staging`);
  }
  expect(await collegeNames(pool)).toEqual([]);

  const codes = () =>
    Array.from({ length: 10 }, () => randomBytes(6).toString("hex"));
  const backupCodes = codes();
  const headBackupCodes = codes();
  const secrets = {
    DEMO_PASSWORD: randomBytes(12).toString("base64url"),
    DEMO_ADMIN_PASSWORD: randomBytes(12).toString("base64url"),
    DEMO_TOTP_SECRET: randomBytes(24).toString("base64url"),
    DEMO_BACKUP_CODES: backupCodes.join(","),
    DEMO_HEAD_BACKUP_CODES: headBackupCodes.join(","),
  };
  const seeded = await seedDemo([], { ...staging, ...secrets });
  expect(seeded.code, seeded.stderr).toBe(0);
  const people = await demoPeople(pool);
  const password = (account: { employeeNumber: string }) =>
    people.find(
      ({ employee_number }) => employee_number === account.employeeNumber,
    )?.password;

  // The admin's password is its own.
  const checks = [
    [demoAccounts.admin, secrets.DEMO_ADMIN_PASSWORD, true],
    [demoAccounts.admin, secrets.DEMO_PASSWORD, false],
    [demoAccounts.head, secrets.DEMO_PASSWORD, true],
    [demoAccounts.trainer, secrets.DEMO_PASSWORD, true],
  ] as const;
  for (const [account, typed, matches] of checks) {
    expect(
      await verifyPassword({ hash: password(account) ?? "", password: typed }),
      `${account.employeeNumber} ${matches}`,
    ).toBe(matches);
  }
  const { rows } = await pool.query(`
    select u.email, t.secret, t.backup_codes from two_factors t
    join users u on u.id = t.user_id`);
  expect(rows).toHaveLength(4);
  for (const { email, secret, backup_codes } of rows) {
    expect(await decrypt(url, secret)).toBe(secrets.DEMO_TOTP_SECRET);
    expect(JSON.parse(await decrypt(url, backup_codes))).toEqual(
      email === demoAccounts.admin.email ? backupCodes : headBackupCodes,
    );
  }
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
