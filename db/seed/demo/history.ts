import { eq } from "drizzle-orm";
import {
  listDirectory,
  listRoles,
  type PersonEntry,
} from "../../../src/modules/access/index.ts";
import {
  type AuditAction,
  auditEvents,
} from "../../../src/modules/audit/index.ts";
import { listDepartments } from "../../../src/modules/org/index.ts";
import { settingsRegistry } from "../../../src/modules/settings/index.ts";
import type { Db } from "../../../src/platform/db/client.ts";
import { startOfDay, wallClock } from "../../../src/platform/i18n/time-zone.ts";
import { demoAccounts } from "./accounts.ts";
import { demoSettings } from "./settings.ts";

// Three weeks of the demo college's log, so the audit log and each record's history have a past to
// show (Step 11): the admin setting the college up and adding its people, everyone's first sign-in,
// the heads' two-factor, and the working days since, with a lockout and the head's temporary
// password, a corrected employee number and email, a disabled account, a head's lost phone and an
// export. Each event
// carries what the code that writes it would (src/modules). The times count back from the run, on
// the college's clock; the log is written once, while it is empty, so a re-run adds nothing.

const DAYS = 21;
const MINUTE = 60_000;
const ZONE = demoSettings["locale.timeZone"];

// What people sign in with: a desktop in the college's offices, or a phone on its Wi-Fi.
const DESKTOPS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
];
const PHONES = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
];

type Device = { ip: string; userAgent: string };

export async function seedDemoHistory(
  { db, random }: { db: Db; random: () => number },
  collegeId: string,
) {
  const [written] = await db
    .select({ id: auditEvents.id })
    .from(auditEvents)
    .where(eq(auditEvents.collegeId, collegeId))
    .limit(1);
  if (written) return;

  const [directory, roles, departments] = await Promise.all([
    listDirectory(collegeId, {}, db),
    listRoles(collegeId, db),
    listDepartments(collegeId, db),
  ]);
  const roleKeys = new Map(roles.map((role) => [role.id, role.key]));
  const holds = (person: PersonEntry, key: string) =>
    person.memberships.filter(
      (membership) => roleKeys.get(membership.roleId) === key,
    );
  const byNumber = (employeeNumber: string) => {
    const person = directory.find(
      (each) => each.employeeNumber === employeeNumber,
    );
    if (!person) throw new Error(`seed:demo: no person ${employeeNumber}`);
    return person;
  };
  const pick = <T>(list: readonly T[]) =>
    list[Math.floor(random() * list.length)];
  const chance = (p: number) => random() < p;

  // Each person's own device and address, kept for the three weeks.
  const devices = new Map<string, Device>(
    directory.map((person, index) => {
      const phone = chance(0.35);
      return [
        person.userId,
        phone
          ? {
              ip: `10.40.${1 + (index % 4)}.${30 + index}`,
              userAgent: pick(PHONES),
            }
          : {
              ip: `10.20.${1 + (index % 3)}.${40 + index}`,
              userAgent: pick(DESKTOPS),
            },
      ];
    }),
  );

  // A day this many days back on the college's clock, and an instant in it; today's instants count
  // back from now, so none is in the future.
  const now = Date.now();
  const [year, month, date] = wallClock(new Date(now), ZONE)
    .slice(0, 10)
    .split("-")
    .map(Number);
  const day = (daysAgo: number) =>
    new Date(Date.UTC(year, month - 1, date - daysAgo))
      .toISOString()
      .slice(0, 10);
  const at = (daysAgo: number, hour: number, minute: number) =>
    daysAgo === 0
      ? now - (60 * Math.max(0, 14 - hour) + 60 - minute) * MINUTE
      : startOfDay(day(daysAgo), ZONE).getTime() +
        (hour * 60 + minute) * MINUTE;
  // Friday and Saturday are the weekend.
  const workday = (daysAgo: number) =>
    ![5, 6].includes(new Date(`${day(daysAgo)}T00:00:00Z`).getUTCDay());

  const events: (typeof auditEvents.$inferInsert)[] = [];
  const add = (
    time: number,
    actor: PersonEntry | null,
    action: AuditAction,
    entity: { type: string; id: string },
    diff?: Record<string, unknown>,
    // The request's device: the actor's, or for the system, the person whose request it answered.
    device = actor ? devices.get(actor.userId) : undefined,
  ) =>
    events.push({
      collegeId,
      actorId: actor?.userId ?? null,
      action,
      entityType: entity.type,
      entityId: entity.id,
      diff,
      ip: device?.ip ?? null,
      userAgent: device?.userAgent ?? null,
      createdAt: new Date(time),
    });
  const user = (person: PersonEntry) => ({ type: "user", id: person.userId });
  const membershipsOf = (person: PersonEntry, key: string) =>
    holds(person, key).map((membership) => ({
      id: membership.id,
      to: {
        userId: person.userId,
        role: key,
        departmentId: membership.departmentId,
      },
    }));

  const admin = byNumber(demoAccounts.admin.employeeNumber);
  const heads = directory.filter((person) => holds(person, "head").length > 0);
  const college = [
    demoAccounts.dean,
    demoAccounts.viceDean,
    demoAccounts.qualityReviewer,
  ].map(({ employeeNumber }) => byNumber(employeeNumber));
  const trainers = directory.filter(
    (person) => holds(person, "trainer").length > 0,
  );
  const invited = byNumber(demoAccounts.invitedTrainer.employeeNumber);
  const disabled = byNumber(demoAccounts.disabledTrainer.employeeNumber);
  const headOf = (person: PersonEntry) => {
    const [{ departmentId }] = holds(person, "trainer");
    return heads.find((head) =>
      holds(head, "head").some((each) => each.departmentId === departmentId),
    );
  };

  // Day 21: the admin sets the college up, then adds its leaders one by one.
  let minute = 10;
  const setup = () => at(DAYS, 8, minute++);
  for (const key of ["platform.name", "pilot.bannerText"] as const) {
    add(
      setup(),
      admin,
      "setting.update",
      { type: "setting", id: key },
      {
        from: settingsRegistry[key].default,
        to: demoSettings[key],
      },
    );
  }
  for (const department of departments) {
    add(
      setup(),
      admin,
      "department.create",
      {
        type: "department",
        id: department.id,
      },
      {
        to: {
          name: department.name,
          shortName: department.shortName,
          rayatValues: [...department.rayatValues].sort(),
          active: true,
        },
      },
    );
  }
  const head = roles.find((role) => role.key === "head");
  if (head) {
    const helping = ["accounts.resetPassword", "accounts.linkEmployeeNumber"];
    add(
      setup(),
      admin,
      "role.update",
      { type: "role", id: head.id },
      {
        from: {
          permissions: head.permissions.filter((key) => !helping.includes(key)),
        },
        to: { permissions: head.permissions },
      },
    );
  }
  const created = (person: PersonEntry, time: number, key: string) => {
    add(
      time,
      admin,
      "account.create",
      user(person),
      {
        to: {
          name: person.name,
          email: person.email,
          employeeNumber: person.employeeNumber,
        },
      },
      devices.get(admin.userId),
    );
    for (const membership of membershipsOf(person, key)) {
      add(
        time + 1000,
        admin,
        "membership.create",
        {
          type: "membership",
          id: membership.id,
        },
        { to: membership.to },
      );
    }
  };
  for (const person of [...college, ...heads]) {
    const key = roleKeys.get(person.memberships[0].roleId) ?? "";
    created(person, at(DAYS, 9, minute), key);
    minute += 3;
  }

  // Day 20: the trainers arrive in one import, a second apart.
  trainers.forEach((person, index) => {
    created(person, at(DAYS - 1, 9, 5) + index * 2000, "trainer");
  });

  // Everyone's first sign-in replaces the temporary password; the heads then set up two-factor,
  // which their keys require. The invited trainer has not signed in yet.
  const firstDay = new Map<string, number>();
  const firstSignIn = (person: PersonEntry, daysAgo: number, hour: number) => {
    const time = at(daysAgo, hour, Math.floor(random() * 50));
    add(time, person, "session.signIn", user(person));
    add(time + 2 * MINUTE, person, "account.changePassword", user(person));
    firstDay.set(person.userId, daysAgo);
    return time;
  };
  for (const person of heads) {
    const time = firstSignIn(person, DAYS - 1, 10);
    add(time + 4 * MINUTE, person, "account.startTwoFactorSetup", user(person));
    add(time + 6 * MINUTE, person, "account.enableTwoFactor", user(person));
  }
  for (const person of college) firstSignIn(person, DAYS - 1, 11);
  for (const person of trainers) {
    if (person === invited) continue;
    let daysAgo = DAYS - 2 - Math.floor(random() * 6);
    while (!workday(daysAgo)) daysAgo -= 1;
    firstSignIn(person, daysAgo, 8 + Math.floor(random() * 5));
  }

  // The stories of the weeks since.
  const secretaries = trainers.filter(
    (person) => holds(person, "secretary").length > 0,
  );
  secretaries.forEach((person, index) => {
    for (const membership of membershipsOf(person, "secretary")) {
      add(
        at(15, 10, 20 + index * 2),
        admin,
        "membership.create",
        {
          type: "membership",
          id: membership.id,
        },
        { to: membership.to },
      );
    }
  });
  const helped = trainers.filter(
    (person) => person !== invited && person !== disabled && headOf(person),
  );
  const locked = pick(helped);
  const lockedAt = at(12, 9, 14);
  add(
    lockedAt,
    null,
    "account.lock",
    user(locked),
    {
      lockedUntil: new Date(lockedAt + 15 * MINUTE).toISOString(),
    },
    devices.get(locked.userId),
  );
  const lockedHead = headOf(locked);
  if (lockedHead) {
    add(
      lockedAt + 6 * MINUTE,
      lockedHead,
      "account.resetPassword",
      user(locked),
    );
  }
  add(lockedAt + 25 * MINUTE, locked, "session.signIn", user(locked));
  add(lockedAt + 27 * MINUTE, locked, "account.changePassword", user(locked));

  const renumbered = pick(helped.filter((person) => person !== locked));
  const digits = renumbered.employeeNumber.split("");
  [digits[3], digits[4]] = [digits[4], digits[3]];
  const typo =
    digits.join("") === renumbered.employeeNumber
      ? `${renumbered.employeeNumber.slice(0, -1)}9`
      : digits.join("");
  const renumberedHead = headOf(renumbered);
  if (renumberedHead) {
    add(
      at(8, 11, 32),
      renumberedHead,
      "person.linkEmployeeNumber",
      user(renumbered),
      {
        from: { employeeNumber: typo },
        to: { employeeNumber: renumbered.employeeNumber },
      },
    );
  }
  const renamed = pick(
    helped.filter((person) => person !== locked && person !== renumbered),
  );
  add(at(6, 10, 5), admin, "person.update", user(renamed), {
    from: { email: renamed.email.replace("@", ".old@") },
    to: { email: renamed.email },
  });
  add(at(5, 12, 41), admin, "account.disable", user(disabled));

  // Every working day: the heads at the start of the day, the admin and the college's leaders on
  // most days, and some trainers; some sign out when they leave.
  const disabledOn = 5;
  for (let daysAgo = DAYS - 2; daysAgo >= 0; daysAgo -= 1) {
    if (!workday(daysAgo)) continue;
    const routine: [PersonEntry, number][] = [
      ...heads.map((person): [PersonEntry, number] => [person, 1]),
      [admin, 0.6],
      ...college.map((person): [PersonEntry, number] => [person, 0.35]),
      ...trainers.map((person): [PersonEntry, number] => [person, 0.25]),
    ];
    for (const [person, likelihood] of routine) {
      const first = firstDay.get(person.userId);
      if (person !== admin && (first === undefined || first <= daysAgo)) {
        continue;
      }
      if (person === disabled && daysAgo <= disabledOn) continue;
      if (!chance(likelihood)) continue;
      const time = at(
        daysAgo,
        7 + Math.floor(random() * 3),
        Math.floor(random() * 60),
      );
      const twoFactor = person === admin || heads.includes(person);
      add(
        time,
        person,
        "session.signIn",
        user(person),
        twoFactor ? { twoFactor: "totp" } : undefined,
      );
      if (daysAgo > 0 && chance(0.4)) {
        add(
          at(daysAgo, 13, Math.floor(random() * 60)),
          person,
          "session.signOut",
          user(person),
        );
      }
    }
  }

  // A head lost their phone: the admin turned off their two-factor, and they signed in with the
  // password alone and set it up on the new phone (ADR-0014).
  const phoneLost = pick(heads);
  let lostDay = 10;
  while (!workday(lostDay)) lostDay -= 1;
  const lostAt = at(lostDay, 12, 15);
  add(lostAt, admin, "account.disableTwoFactor", user(phoneLost));
  add(lostAt + 9 * MINUTE, phoneLost, "session.signIn", user(phoneLost));
  add(
    lostAt + 11 * MINUTE,
    phoneLost,
    "account.startTwoFactorSetup",
    user(phoneLost),
  );
  add(
    lostAt + 13 * MINUTE,
    phoneLost,
    "account.enableTwoFactor",
    user(phoneLost),
  );

  // Yesterday the admin exported the last week's log.
  const start = at(7, 0, 0);
  const end = at(1, 0, 0);
  add(
    at(1, 12, 30),
    admin,
    "audit.export",
    { type: "college", id: collegeId },
    {
      start: day(7),
      end: day(1),
      rows: events.filter(
        ({ createdAt }) =>
          createdAt instanceof Date &&
          createdAt.getTime() >= start &&
          createdAt.getTime() < end + 24 * 60 * MINUTE,
      ).length,
    },
  );

  events.sort(
    (a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime(),
  );
  for (let index = 0; index < events.length; index += 500) {
    await db.insert(auditEvents).values(events.slice(index, index + 500));
  }
}
