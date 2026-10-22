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
import { demoVisitor } from "../../db/seed/demo/rayat.ts";
import { demoSettings } from "../../db/seed/demo/settings.ts";
import { rayatColumns } from "../../db/seed/rayat-columns.ts";
import { unmatchedTrainers } from "../../src/modules/academics/index.ts";
import { settingsRegistry } from "../../src/modules/settings/index.ts";
import {
  activeTerm,
  calendarOf,
  calendarSettings,
  termWeeks,
} from "../../src/modules/terms/index.ts";
import type { Db } from "../../src/platform/db/client.ts";
import { wallClock } from "../../src/platform/i18n/time-zone.ts";
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
  // The demo's own settings, and Rayat's column maps every college starts with.
  expect(
    (await pool.query("select key, value from settings order by key")).rows,
  ).toEqual(
    [
      ...Object.entries(demoSettings),
      ...Object.entries(rayatColumns).map(
        ([kind, value]) => [`rayat.columns.${kind}`, value] as const,
      ),
    ]
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

// Each demo person, by employee number, with their roles for every term as "key" or
// "key:department"; the role held for one term is the demo term's own (Step 13).
const demoPeople = async (pool: Pool) =>
  (
    await pool.query(`
      select p.employee_number, u.name, u.email, a.password, u.must_change_password,
        u.disabled_at is not null as disabled, u.two_factor_enabled,
        array_agg(r.key || coalesce(':' || d.name, '') order by r.key) as roles
      from users u
      join people p on p.user_id = u.id
      join accounts a on a.user_id = u.id and a.provider_id = 'credential'
      join memberships m on m.user_id = u.id and m.term_id is null
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
    "endorsed_at",
    "published_at",
    "uploaded_at",
    "applied_at",
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
      "account.disableTwoFactor",
      "account.lock",
      "account.resetPassword",
      "person.linkEmployeeNumber",
      "person.update",
      "account.disable",
      "audit.export",
      "notification.read",
      "notification.mute",
      "announcement.publish",
      // The vice-dean's term and its calendar (Step 13).
      "term.create",
      "calendarEvent.create",
      "term.activate",
      "holiday.approve",
      // The vice-dean's framework for it, and its version 2 in the making (Step 15).
      "framework.create",
      "frameworkItem.create",
      "framework.publish",
      "frameworkItem.update",
      // The term's Rayat reports, and a newer SF01 waiting to be applied (Step 16).
      "rayatImport.upload",
      "rayatImport.apply",
      // The head of Electrical's transfer of a section (Step 17).
      "sectionTransfer.create",
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
    select n.id::text, n.kind, n.user_id::text, n.params, n.once_key, n.created_at, n.read_at
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
    // It keeps which of its holder's notifications it counts, and is read with the last of them if
    // not before (ADR-0015).
    const counted = digest.params.ids.map((id: string) =>
      rows.find((row) => row.id === id),
    );
    expect(counted).toHaveLength(digest.params.count);
    for (const row of counted) expect(row?.user_id).toBe(digest.user_id);
    const reads = counted.map((row: { read_at: Date | null }) => row.read_at);
    if (reads.every(Boolean)) {
      expect(digest.read_at?.getTime()).toBeLessThanOrEqual(
        Math.max(...reads.map((read: Date) => read.getTime())),
      );
    }
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

  // The demo trainer, whom the end-to-end tests sign in as, has read everything, whatever day the
  // seed runs (Audit 4).
  const { rows: trainer } = await pool.query(
    `select count(*) filter (where n.read_at is null) as unread, count(*) as told
     from notifications n join people p on p.user_id = n.user_id where p.employee_number = $1`,
    [demoAccounts.trainer.employeeNumber],
  );
  expect(Number(trainer[0].told)).toBeGreaterThan(0);
  expect(Number(trainer[0].unread)).toBe(0);

  // Each reading is in the log, with how many it read.
  const {
    rows: [{ read, logged }],
  } = await pool.query(`
    select (select count(*) from notifications where read_at is not null) as read,
      (select coalesce(sum((diff->>'count')::int), 0) from audit_events
       where action = 'notification.read') as logged`);
  expect(Number(read)).toBeGreaterThan(0);
  expect(Number(logged)).toBe(Number(read));

  // Two trainers turned the digest off, as the log records, and were sent none after.
  const { rows: off } = await pool.query(`
    select user_id::text, updated_at from notification_prefs
    where kind = 'weeklyDigest' and not enabled`);
  expect(off).toHaveLength(2);
  const { rows: mutes } = await pool.query(`
    select actor_id from audit_events where action = 'notification.mute'`);
  expect(mutes.map(({ actor_id }) => actor_id).sort()).toEqual(
    off.map(({ user_id }) => user_id).sort(),
  );
  for (const { user_id, updated_at } of off) {
    expect(
      digests.filter(
        (digest) =>
          digest.user_id === user_id && digest.created_at > updated_at,
      ),
    ).toEqual([]);
  }
});

it("announces as the head of Electrical and the dean did, to everyone enabled in each scope but its author, and only the invited trainer has one left to read (ADR-0017)", async () => {
  const { pool } = await seededDatabase();
  const { rows: said } = await pool.query(`
    select a.id::text, a.department_id::text, u.email as author
    from announcements a join users u on u.id = a.author_id order by a.created_at`);
  expect(said.map(({ author }) => author)).toEqual([
    demoAccounts.head.email,
    demoAccounts.dean.email,
  ]);
  for (const announcement of said) {
    const { rows: told } = await pool.query(
      `select user_id::text from notifications
       where kind = 'announcement' and params->>'announcementId' = $1 order by user_id`,
      [announcement.id],
    );
    const { rows: scope } = await pool.query(
      `select p.user_id::text from people p join users u on u.id = p.user_id
       where u.disabled_at is null and u.email <> $1 and ($2::uuid is null or exists (
         select 1 from memberships m where m.user_id = p.user_id and m.department_id = $2))
       order by p.user_id`,
      [announcement.author, announcement.department_id],
    );
    expect(told.length, announcement.author).toBeGreaterThan(0);
    expect(told).toEqual(scope);
  }
  const { rows: unread } = await pool.query(`
    select distinct u.email from notifications n join users u on u.id = n.user_id
    where n.kind = 'announcement' and n.read_at is null`);
  const waiting = new Set(unread.map(({ email }) => email));
  for (const [name, account] of Object.entries(demoAccounts)) {
    expect(waiting.has(account.email), name).toBe(name === "invitedTrainer");
  }
  const { rows: published } = await pool.query(`
    select entity_id from audit_events where action = 'announcement.publish' order by created_at`);
  expect(published.map(({ entity_id }) => entity_id)).toEqual(
    said.map(({ id }) => id),
  );
});

// The week of the demo college's active term today falls in: its own, or the first numbered one
// after it while an Eid break takes this one (Step 13).
async function demoWeek(db: Db, pool: Pool) {
  const {
    rows: [{ id: collegeId }],
  } = await pool.query("select id from colleges");
  const term = await activeTerm(collegeId, db);
  if (!term) throw new Error("no active term");
  const settings = await calendarSettings(collegeId, db);
  const today = wallClock(
    new Date(),
    settingsRegistry["locale.timeZone"].default,
  ).slice(0, 10);
  const week = termWeeks(
    calendarOf(term, term.events, settings, term.breaks),
  ).find((each) => each.endsOn >= today && each.number !== null);
  return { term, number: week?.number };
}

it("starts the demo term on the day that puts today in week 9, counted past the Eid breaks, with the calendar the vice-dean entered and one role held in it (Step 13)", async () => {
  const { db, pool } = await seededDatabase();
  const { term, number } = await demoWeek(db, pool);
  expect(number).toBe(9);
  expect(term).toMatchObject({ weeks: 18, status: "active" });
  expect(new Set(term.events.map(({ kind }) => kind))).toEqual(
    new Set(["custom", "exam", "holiday", "gradeDeadline"]),
  );
  const { rows: actors } = await pool.query(
    `select distinct u.email from audit_events e join users u on u.id::text = e.actor_id
     where e.entity_type = 'term'`,
  );
  expect(actors).toEqual([{ email: demoAccounts.viceDean.email }]);
  // Electrical's secretary for this term only.
  const { rows: held } = await pool.query(
    `select r.key, d.name from memberships m join roles r on r.id = m.role_id
     join departments d on d.id = m.department_id where m.term_id = $1`,
    [term.id],
  );
  expect(held).toEqual([{ key: "secretary", name: demoDepartments[1].name }]);
  // Held for that term only: not by its secretary for every term (Audit 5).
  const { rows: everyTerm } = await pool.query(
    `select m.id from memberships m join memberships held
       on held.user_id = m.user_id and held.role_id = m.role_id
         and held.department_id = m.department_id
     where held.term_id = $1 and m.term_id is null`,
    [term.id],
  );
  expect(everyTerm).toEqual([]);
});

it("approves the coming holiday, and keeps the framework's version 2 as a draft beside the published one (Audit 5)", async () => {
  const { pool } = await seededDatabase();
  const today = wallClock(
    new Date(),
    settingsRegistry["locale.timeZone"].default,
  ).slice(0, 10);
  const { rows: approved } = await pool.query(
    `select to_char(starts_on, 'YYYY-MM-DD') as "startsOn" from holidays where adjusted`,
  );
  const { rows: coming } = await pool.query(
    `select to_char(starts_on, 'YYYY-MM-DD') as "startsOn" from holidays
     where starts_on > $1 order by starts_on, key limit 1`,
    [today],
  );
  expect(approved).toEqual(coming);
  const { rows: versions } = await pool.query(
    "select version, status from frameworks order by version",
  );
  expect(versions).toEqual([
    { version: 1, status: "published" },
    { version: 2, status: "draft" },
  ]);
  const { rows: changed } = await pool.query(
    `select f.version, i.due from framework_items i join frameworks f on f.id = i.framework_id
     where i.kind = 'grade_analysis' order by f.version`,
  );
  expect(changed).toEqual([
    { version: 1, due: { type: "afterEvent", eventKind: "exam", weeks: 1 } },
    { version: 2, due: { type: "afterEvent", eventKind: "exam", weeks: 2 } },
  ]);
});

it("imports the demo term's SS01, SF01 and SO01 as the vice-dean and the head of Electrical, whose role the admin gave the key, every section taught by its department's trainers, and leaves the head's newer SF01 to review (Step 16, ADR-0019)", async () => {
  const { pool } = await seededDatabase();
  const { rows: imports } = await pool.query(
    `select i.kind, i.status, u.email as "uploadedBy", a.email as "appliedBy",
       i.diff - 'samples' as counts
     from rayat_imports i join users u on u.id = i.uploaded_by
     left join users a on a.id = i.applied_by
     order by i.uploaded_at`,
  );
  const viceDean = demoAccounts.viceDean.email;
  const head = demoAccounts.head.email;
  // The head imports because the admin gave the head's role the key on the roles page.
  const { rows: grants } = await pool.query(
    `select u.email from audit_events e
     join users u on u.id::text = e.actor_id
     join roles r on r.id::text = e.entity_id
     where e.action = 'role.update' and r.key = 'head'
       and e.diff->'to'->'permissions' ? 'rayat.import'`,
  );
  expect(grants).toEqual([{ email: demoAccounts.admin.email }]);
  expect(imports).toEqual([
    {
      kind: "ss01",
      status: "applied",
      uploadedBy: viceDean,
      appliedBy: viceDean,
      counts: expect.objectContaining({ removed: 0 }),
    },
    {
      kind: "sf01",
      status: "applied",
      uploadedBy: viceDean,
      appliedBy: viceDean,
      counts: expect.objectContaining({ removed: 0 }),
    },
    {
      kind: "so01",
      status: "applied",
      uploadedBy: head,
      appliedBy: viceDean,
      counts: expect.objectContaining({ removed: 0 }),
    },
    {
      kind: "sf01",
      status: "pending",
      uploadedBy: head,
      appliedBy: null,
      counts: expect.objectContaining({ added: 2, removed: 0, changed: 3 }),
    },
  ]);
  // Each section is taught by a trainer of its department, but Electrical's visitor (Step 17).
  const { rows: departments } = await pool.query(
    `select d.name, count(*)::int > 0 as sections,
      bool_and(s.trainer_numbers = array[$1] or exists (
        select 1 from people p
        join memberships m on m.user_id = p.user_id
        join roles r on r.id = m.role_id and r.key = 'trainer'
        where m.department_id = s.department_id and p.employee_number = any(s.trainer_numbers)
      )) as taught
    from rayat_sections s join departments d on d.id = s.department_id
    group by d.name order by d.name`,
    [demoVisitor.employeeNumber],
  );
  expect(departments).toEqual(
    demoDepartments
      .map(({ name }) => ({ name, sections: true, taught: true }))
      .sort((a, b) => (a.name < b.name ? -1 : 1)),
  );
});

it("has the head of Electrical transfer a section to another trainer of the department from this week, and Electrical's visitor named as not on the platform (Step 17)", async () => {
  const { db, pool } = await seededDatabase();
  const { rows: transfers } = await pool.query(`
    select d.name as department, u.email as by, t.week,
      exists (select 1 from people p where p.employee_number = t.from_number) as "fromOnPlatform",
      exists (
        select 1 from memberships m join roles r on r.id = m.role_id and r.key = 'trainer'
        where m.user_id = t.to_user_id and m.department_id = t.department_id
      ) as "toTeachesThere"
    from section_transfers t join departments d on d.id = t.department_id
    join users u on u.id = t.created_by`);
  expect(transfers).toEqual([
    {
      department: demoDepartments[1].name,
      by: demoAccounts.head.email,
      week: 9,
      fromOnPlatform: true,
      toTeachesThere: true,
    },
  ]);
  const {
    rows: [{ id: collegeId }],
  } = await pool.query("select id from colleges");
  const term = await activeTerm(collegeId, db);
  if (!term) throw new Error("no active term");
  const unmatched = await unmatchedTrainers(collegeId, term.id, db);
  expect(unmatched.map(({ number }) => number)).toEqual([
    demoVisitor.employeeNumber,
  ]);
  expect(unmatched[0].sections.length).toBeGreaterThan(0);
});

it("puts today in the week --week asks for, and exits 1 for a week outside the term", async () => {
  const database = await freshDatabase();
  const seeded = await seedDemo(
    ["--seed", "42", "--week", "3"],
    scriptEnv(database.url),
  );
  expect(seeded.code, seeded.stderr).toBe(0);
  expect((await demoWeek(database.db, database.pool)).number).toBe(3);
  for (const week of ["0", "19", "nine"]) {
    const refused = await seedDemo(["--week", week], scriptEnv(database.url));
    expect(refused.code, week).toBe(1);
    expect(refused.stderr).toContain("--week");
  }
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
