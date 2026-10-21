import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { seedBase } from "../../db/seed/base.ts";
import {
  changePassword,
  confirmTwoFactorSetup,
  createAccount,
  getAuth,
  getSessionUser,
  linkEmployeeNumber,
  lockedAccounts,
  reauthenticate,
  resetPassword,
  type SignInInput,
  setAccountDisabled,
  signIn,
  signOut,
  startTwoFactorSetup,
  turnOffOwnTwoFactor,
  turnOffTwoFactor,
  updatePerson,
  verifySignInCode,
} from "../../src/modules/identity/index.ts";
import { getDb } from "../../src/platform/db/client.ts";
import { base32Bytes, totp } from "../support/totp.ts";
import { createSharedTestDatabase } from "./support/database.ts";

// The request getSessionUser reads, and a cookie store for Better Auth's Next.js plugin, which
// writes the cookies it sets through next/headers.
const request = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({
  headers: async () => request.headers,
  cookies: async () => ({ set: () => {} }),
}));

// Counts the passwords the platform hashes, around the real hash.
const hashing = vi.hoisted(() => ({ count: 0 }));
vi.mock("better-auth/crypto", async (importOriginal) => {
  const original = await importOriginal<typeof import("better-auth/crypto")>();
  return {
    ...original,
    hashPassword: async (password: string) => {
      hashing.count++;
      return original.hashPassword(password);
    },
  };
});

const PASSWORD = "correct-horse-battery";
const MINUTE_MS = 60_000;

let database: Awaited<ReturnType<typeof createSharedTestDatabase>>;
let collegeId: string;
let lastEmployeeNumber = 3000;

beforeAll(async () => {
  database = await createSharedTestDatabase();
  collegeId = await seedBase(database.db, {
    name: "Test College",
    shortName: "TC",
  });
});

afterAll(() => database?.drop());

const query = async (text: string, values: unknown[] = []) =>
  (await database.pool.query(text, values)).rows;

// A person with a known password, an employee number and an email of their own.
async function person() {
  const employeeNumber = String(++lastEmployeeNumber);
  const email = `person.${employeeNumber}@college.example`;
  const { userId } = await getDb().transaction((tx) =>
    createAccount(
      { collegeId, name: `Person ${employeeNumber}`, email, employeeNumber },
      tx,
      PASSWORD,
    ),
  );
  return { userId, email, employeeNumber };
}

// A request from this address, as Caddy forwards it.
const from = (ip: string) =>
  new Headers({ "x-forwarded-for": ip, "user-agent": "integration-test" });

const attempt = (
  input: Partial<SignInInput> & { identifier: string },
  ip: string,
  now?: Date,
) => signIn({ password: PASSWORD, remember: false, ...input }, from(ip), now);

// The cookies an answer sets, as the browser sends them back.
const cookieHeader = (headers: Headers) =>
  headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");

// A signed-in device: the cookie Better Auth sets, as the browser sends it back.
async function signedInDevice(email: string) {
  const { headers } = await getAuth().api.signInEmail({
    body: { email, password: PASSWORD, rememberMe: true },
    returnHeaders: true,
  });
  const cookie = cookieHeader(headers);
  const [session] = await query(
    "select id from sessions where token = split_part(split_part($1, '=', 2), '.', 1)",
    [cookie],
  );
  return {
    headers: new Headers({ cookie }),
    sessionId: session.id as string,
  };
}

async function store(key: string, value: unknown) {
  await query(
    `insert into settings (college_id, key, value) values ($1, $2, $3)
     on conflict (college_id, key) do update set value = excluded.value`,
    [collegeId, key, JSON.stringify(value)],
  );
}

describe("signIn", () => {
  it("signs in by employee number, typed in Arabic-Indic digits, or by email in any case, and audits it", async () => {
    const { userId, email, employeeNumber } = await person();
    const arabicIndic = employeeNumber.replace(/\d/g, (digit) =>
      String.fromCharCode(0x0660 + Number(digit)),
    );

    expect(await attempt({ identifier: arabicIndic }, "10.0.1.1")).toEqual({
      status: "signedIn",
    });
    expect(
      await attempt({ identifier: ` ${email.toUpperCase()} ` }, "10.0.1.1"),
    ).toEqual({ status: "signedIn" });

    expect(
      await query(
        "select actor_id, action, ip, user_agent from audit_events where entity_id = $1",
        [userId],
      ),
    ).toEqual(
      Array(2).fill({
        actor_id: userId,
        action: "session.signIn",
        ip: "10.0.1.1",
        user_agent: "integration-test",
      }),
    );
  });

  it("answers alike for an unknown account and a wrong password", async () => {
    const { employeeNumber } = await person();

    // As long as a wrong password, too: the typed password is hashed all the same.
    hashing.count = 0;
    expect(await attempt({ identifier: "999999" }, "10.0.2.1")).toEqual({
      status: "invalid",
    });
    expect(hashing.count).toBe(1);
    expect(
      await attempt(
        { identifier: employeeNumber, password: "wrong-password" },
        "10.0.2.1",
      ),
    ).toEqual({ status: "invalid" });
  });

  it("remembers the device only when asked", async () => {
    const { userId, employeeNumber } = await person();

    await attempt({ identifier: employeeNumber, remember: true }, "10.0.3.1");
    await attempt({ identifier: employeeNumber, remember: false }, "10.0.3.1");

    expect(
      await query(
        "select remembered from sessions where user_id = $1 order by created_at",
        [userId],
      ),
    ).toEqual([{ remembered: true }, { remembered: false }]);
  });

  it("locks the account after the threshold of wrong passwords, from any address, and audits the lock once", async () => {
    const { userId, employeeNumber } = await person();
    const now = new Date();
    const wrong = (ip: string) =>
      attempt(
        { identifier: employeeNumber, password: "wrong-password" },
        ip,
        now,
      );

    // The default threshold is five.
    for (const ip of ["10.0.4.1", "10.0.4.2", "10.0.4.3", "10.0.4.4"]) {
      expect(await wrong(ip)).toEqual({ status: "invalid" });
    }
    expect(await wrong("10.0.4.5")).toEqual({ status: "locked", minutes: 15 });

    // The right password does not open a locked account, from a new address either.
    expect(
      await attempt({ identifier: employeeNumber }, "10.0.4.6", now),
    ).toEqual({ status: "locked", minutes: 15 });
    expect(
      await query(
        "select actor_id, action from audit_events where entity_id = $1",
        [userId],
      ),
    ).toEqual([{ actor_id: null, action: "account.lock" }]);

    // Once the lock ends, the right password opens it again.
    const later = new Date(now.getTime() + 15 * MINUTE_MS);
    expect(
      await attempt({ identifier: employeeNumber }, "10.0.4.6", later),
    ).toEqual({ status: "signedIn" });
  });

  it("answers what was typed with no account exactly as an account, through the lockout", async () => {
    const { employeeNumber } = await person();
    const now = new Date();
    const later = new Date(now.getTime() + 15 * MINUTE_MS);
    // Six wrong passwords, each from a new address, then one more once the lock has ended.
    const answers = async (identifier: string) => {
      const wrong = (ip: string, at: Date) =>
        attempt({ identifier, password: "wrong-password" }, ip, at);
      const results = [];
      for (let index = 1; index <= 6; index++) {
        results.push(await wrong(`10.0.9.${index}`, now));
      }
      results.push(await wrong("10.0.9.7", later));
      return results;
    };

    const invalid = { status: "invalid" };
    const locked = { status: "locked", minutes: 15 };
    const expected = [invalid, invalid, invalid, invalid, locked, locked];
    expect(await answers(employeeNumber)).toEqual([...expected, invalid]);
    expect(await answers("777777")).toEqual([...expected, invalid]);
  });

  it("counts an account's email and employee number apart, as two identifiers with no account, and a sign-in clears both", async () => {
    const { email, employeeNumber } = await person();
    const now = new Date();
    // Five wrong passwords on one identifier, then one on the other.
    const answers = async (first: string, second: string) => {
      const results = [];
      for (let index = 1; index <= 5; index++) {
        results.push(
          await attempt(
            { identifier: first, password: "wrong-password" },
            `10.0.12.${index}`,
            now,
          ),
        );
      }
      results.push(
        await attempt(
          { identifier: second, password: "wrong-password" },
          "10.0.12.9",
          now,
        ),
      );
      return results;
    };

    const invalid = { status: "invalid" };
    const expected = [invalid, invalid, invalid, invalid];
    expect(await answers(email, employeeNumber)).toEqual([
      ...expected,
      { status: "locked", minutes: 15 },
      invalid,
    ]);
    expect(await answers("nobody@college.example", "444444")).toEqual([
      ...expected,
      { status: "locked", minutes: 15 },
      invalid,
    ]);

    // Signing in with the other identifier lifts the email's lock too.
    expect(
      await attempt({ identifier: employeeNumber }, "10.0.12.9", now),
    ).toEqual({ status: "signedIn" });
    expect(await attempt({ identifier: email }, "10.0.12.9", now)).toEqual({
      status: "signedIn",
    });
  });

  it("counts attempts that race each other before checking them, so they lock once", async () => {
    const { userId, employeeNumber } = await person();
    const now = new Date();

    const answers = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        attempt(
          { identifier: employeeNumber, password: "wrong-password" },
          `10.0.13.${index}`,
          now,
        ),
      ),
    );

    expect(answers.filter(({ status }) => status === "invalid")).toHaveLength(
      4,
    );
    expect(answers.filter(({ status }) => status === "locked")).toHaveLength(8);
    expect(
      await query(
        "select action from audit_events where entity_id = $1 and action = 'account.lock'",
        [userId],
      ),
    ).toEqual([{ action: "account.lock" }]);
  });

  it("starts the lockout's count again after a sign-in", async () => {
    const { employeeNumber } = await person();
    const wrong = () =>
      attempt(
        { identifier: employeeNumber, password: "wrong-password" },
        "10.0.11.1",
      );

    for (let count = 0; count < 4; count++) await wrong();
    expect(await attempt({ identifier: employeeNumber }, "10.0.11.1")).toEqual({
      status: "signedIn",
    });
    for (let count = 0; count < 4; count++) {
      expect(await wrong()).toEqual({ status: "invalid" });
    }
  });

  it("counts wrong passwords for the lockout's minutes, so ones further apart never lock", async () => {
    const { employeeNumber } = await person();
    const now = new Date();
    const later = new Date(now.getTime() + 15 * MINUTE_MS);

    for (const identifier of [employeeNumber, "666666"]) {
      const wrong = (at: Date) =>
        attempt({ identifier, password: "wrong-password" }, "10.0.10.1", at);
      for (let count = 0; count < 4; count++) {
        expect(await wrong(now)).toEqual({ status: "invalid" });
      }
      // The count has ended, so the fifth starts a new one.
      expect(await wrong(later)).toEqual({ status: "invalid" });
    }
  });

  describe("with five attempts per identifier and address", () => {
    beforeAll(async () => {
      await store("auth.signInAttempts", 5);
      // High enough that the attempts run out before the account locks.
      await store("auth.lockoutThreshold", 20);
    });

    afterAll(() =>
      query("delete from settings where college_id = $1", [collegeId]),
    );

    it("holds back the account at that address only, so a shared address never blocks the others", async () => {
      const [one, other] = [await person(), await person()];
      const shared = "10.0.5.1";
      const now = new Date();

      for (let count = 0; count < 5; count++) {
        expect(
          await attempt(
            { identifier: one.employeeNumber, password: "wrong-password" },
            shared,
            now,
          ),
        ).toEqual({ status: "invalid" });
      }
      // The sixth attempt waits for the window to pass, the right password too.
      expect(
        await attempt({ identifier: one.employeeNumber }, shared, now),
      ).toEqual({ status: "throttled", minutes: 15 });

      expect(
        await attempt({ identifier: other.employeeNumber }, shared, now),
      ).toEqual({ status: "signedIn" });
      expect(
        await attempt({ identifier: one.employeeNumber }, "10.0.5.2", now),
      ).toEqual({ status: "signedIn" });

      const later = new Date(now.getTime() + 15 * MINUTE_MS + 1);
      expect(
        await attempt({ identifier: one.employeeNumber }, shared, later),
      ).toEqual({ status: "signedIn" });
    });

    it("holds back what was typed at that address when no account matches", async () => {
      const now = new Date();
      for (let count = 0; count < 5; count++) {
        expect(
          await attempt({ identifier: "888888" }, "10.0.6.1", now),
        ).toEqual({ status: "invalid" });
      }
      expect(await attempt({ identifier: "888888" }, "10.0.6.1", now)).toEqual({
        status: "throttled",
        minutes: 15,
      });
      expect(await attempt({ identifier: "888888" }, "10.0.6.2", now)).toEqual({
        status: "invalid",
      });
    });

    it("counts failures only: a sign-in starts the count again", async () => {
      const { employeeNumber } = await person();
      const now = new Date();
      const wrong = () =>
        attempt(
          { identifier: employeeNumber, password: "wrong-password" },
          "10.0.7.1",
          now,
        );

      for (let count = 0; count < 4; count++) await wrong();
      expect(
        await attempt({ identifier: employeeNumber }, "10.0.7.1", now),
      ).toEqual({ status: "signedIn" });
      for (let count = 0; count < 5; count++) {
        expect(await wrong()).toEqual({ status: "invalid" });
      }
    });
  });
});

describe("resetPassword", () => {
  it("gives a temporary password to replace at sign-in, ends every session, lifts the lock and audits it", async () => {
    const { userId, employeeNumber } = await person();
    const admin = await person();
    await attempt({ identifier: employeeNumber }, "10.0.8.1");
    for (let count = 0; count < 5; count++) {
      await attempt(
        { identifier: employeeNumber, password: "wrong-password" },
        "10.0.8.1",
      );
    }
    expect(await attempt({ identifier: employeeNumber }, "10.0.8.1")).toEqual({
      status: "locked",
      minutes: 15,
    });

    const temporary = await resetPassword(
      { userId, collegeId },
      { userId: admin.userId, ip: "10.0.8.2", userAgent: "integration-test" },
    );

    expect(temporary).toMatch(/^[a-z2-9]{12}$/);
    expect(
      await query("select must_change_password from users where id = $1", [
        userId,
      ]),
    ).toEqual([{ must_change_password: true }]);
    expect(
      await query("select id from sessions where user_id = $1", [userId]),
    ).toEqual([]);
    const events = await query(
      "select actor_id, action, diff, ip from audit_events where entity_id = $1 and action = 'account.resetPassword'",
      [userId],
    );
    expect(events).toEqual([
      {
        actor_id: admin.userId,
        action: "account.resetPassword",
        diff: null,
        ip: "10.0.8.2",
      },
    ]);
    expect(JSON.stringify(events)).not.toContain(temporary);

    expect(await attempt({ identifier: employeeNumber }, "10.0.8.1")).toEqual({
      status: "invalid",
    });
    expect(
      await attempt(
        { identifier: employeeNumber, password: temporary },
        "10.0.8.1",
      ),
    ).toEqual({ status: "signedIn" });
  });
});

describe("changePassword", () => {
  it("replaces the password, keeps this device's session as it was, ends the others and audits it", async () => {
    const { userId, email, employeeNumber } = await person();
    await query("update users set must_change_password = true where id = $1", [
      userId,
    ]);
    const here = await signedInDevice(email);
    await query("update sessions set remembered = true where id = $1", [
      here.sessionId,
    ]);
    await signedInDevice(email);

    expect(
      await changePassword(
        { currentPassword: PASSWORD, newPassword: "a-longer-new-password" },
        { userId, sessionId: here.sessionId, collegeId },
        here.headers,
      ),
    ).toEqual({ status: "changed" });

    expect(
      await query("select id, remembered from sessions where user_id = $1", [
        userId,
      ]),
    ).toEqual([{ id: here.sessionId, remembered: true }]);
    expect(
      await query("select must_change_password from users where id = $1", [
        userId,
      ]),
    ).toEqual([{ must_change_password: false }]);
    expect(
      await query(
        "select actor_id, action from audit_events where entity_id = $1",
        [userId],
      ),
    ).toEqual([{ actor_id: userId, action: "account.changePassword" }]);
    expect(
      await attempt(
        { identifier: employeeNumber, password: "a-longer-new-password" },
        "10.0.9.1",
      ),
    ).toEqual({ status: "signedIn" });
  });

  it("refuses a wrong current password, a new one shorter than the setting, and the same one", async () => {
    const { userId, email } = await person();
    const here = await signedInDevice(email);
    const change = (currentPassword: string, newPassword: string) =>
      changePassword(
        { currentPassword, newPassword },
        { userId, sessionId: here.sessionId, collegeId },
        here.headers,
      );

    expect(await change("wrong-password", "a-longer-new-password")).toEqual({
      status: "wrongPassword",
    });
    expect(await change(PASSWORD, "too-short")).toEqual({
      status: "tooShort",
      minLength: 10,
    });
    expect(await change(PASSWORD, PASSWORD)).toEqual({ status: "unchanged" });
    expect(
      await query("select id from audit_events where entity_id = $1", [userId]),
    ).toEqual([]);
  });
});

describe("getSessionUser", () => {
  const MINUTE_MS = 60_000;

  async function deviceSeen(
    email: string,
    session: { remembered: boolean; idle: string; age?: string },
  ) {
    const device = await signedInDevice(email);
    await query(
      `update sessions set remembered = $2,
         last_seen_at = now() - $3::interval,
         created_at = now() - coalesce($4, $3)::interval
       where id = $1`,
      [device.sessionId, session.remembered, session.idle, session.age ?? null],
    );
    request.headers = device.headers;
    return device;
  }

  const stillThere = async (sessionId: string) =>
    (await query("select id from sessions where id = $1", [sessionId])).length;

  it("ends a session that sat idle past the college's limit, and deletes it", async () => {
    const { email } = await person();
    const { sessionId } = await deviceSeen(email, {
      remembered: false,
      idle: "61 minutes",
    });

    expect(await getSessionUser()).toBeNull();
    expect(await stillThere(sessionId)).toBe(0);
  });

  it("keeps a remembered device signed in however long it sat idle, until its days are up", async () => {
    const { userId, email } = await person();
    const kept = await deviceSeen(email, {
      remembered: true,
      idle: "3 days",
    });
    expect(await getSessionUser()).toMatchObject({
      userId,
      sessionId: kept.sessionId,
      collegeId,
    });

    const expired = await deviceSeen(email, {
      remembered: true,
      idle: "1 day",
      age: "31 days",
    });
    expect(await getSessionUser()).toBeNull();
    expect(await stillThere(expired.sessionId)).toBe(0);
  });

  it("notes a request's time at most once a minute", async () => {
    const { email } = await person();
    const { sessionId } = await deviceSeen(email, {
      remembered: false,
      idle: "2 minutes",
    });
    const lastSeen = async () =>
      new Date(
        (
          await query("select last_seen_at from sessions where id = $1", [
            sessionId,
          ])
        )[0].last_seen_at,
      ).getTime();

    await getSessionUser();
    expect(Date.now() - (await lastSeen())).toBeLessThan(MINUTE_MS / 2);

    await query(
      "update sessions set last_seen_at = now() - interval '30 seconds' where id = $1",
      [sessionId],
    );
    const before = await lastSeen();
    await getSessionUser();
    expect(await lastSeen()).toBe(before);
  });
});

describe("two-factor", () => {
  // Set up through the services, as the setup page does: the password again, then the first code.
  async function withTwoFactor() {
    const someone = await person();
    const device = await signedInDevice(someone.email);
    const user = { userId: someone.userId, collegeId };
    const started = await startTwoFactorSetup(
      { password: PASSWORD, issuer: "Test College" },
      user,
      device.headers,
    );
    if (started.status !== "started") throw new Error(started.status);
    const key = base32Bytes(started.secret);
    expect(
      await confirmTwoFactorSetup(totp(key), user, device.headers),
    ).toEqual({ status: "enabled" });
    return { ...someone, key, backupCodes: started.backupCodes };
  }

  // The password step for an account with two-factor: the cookie that carries it to the code.
  async function passwordStep(email: string, remember: boolean) {
    const { headers } = await getAuth().api.signInEmail({
      body: { email, password: PASSWORD, rememberMe: remember },
      returnHeaders: true,
    });
    return new Headers({
      cookie: cookieHeader(headers),
      "user-agent": "integration-test",
    });
  }

  const signInEvents = (userId: string) =>
    query(
      "select diff from audit_events where entity_id = $1 and action = 'session.signIn' order by created_at, id",
      [userId],
    );

  it("is set up with the password and then the first code, and audits both", async () => {
    const { userId } = await withTwoFactor();

    expect(
      await query("select two_factor_enabled from users where id = $1", [
        userId,
      ]),
    ).toEqual([{ two_factor_enabled: true }]);
    expect(
      await query(
        "select actor_id, action from audit_events where entity_id = $1 order by created_at, id",
        [userId],
      ),
    ).toEqual([
      { actor_id: userId, action: "account.startTwoFactorSetup" },
      { actor_id: userId, action: "account.enableTwoFactor" },
    ]);
  });

  it("signs in with the app's code, remembers the device only when the password step asked, and audits it", async () => {
    const { userId, email, key } = await withTwoFactor();

    for (const remember of [true, false]) {
      expect(
        await verifySignInCode(
          { code: totp(key), backup: false },
          await passwordStep(email, remember),
        ),
      ).toEqual({ status: "signedIn" });
    }

    expect(
      await query(
        "select remembered from sessions where user_id = $1 order by created_at desc, id desc limit 2",
        [userId],
      ),
    ).toEqual([{ remembered: false }, { remembered: true }]);
    expect(await signInEvents(userId)).toEqual([
      { diff: { twoFactor: "totp" } },
      { diff: { twoFactor: "totp" } },
    ]);
  });

  it("signs in once with each backup code, and audits it", async () => {
    const { userId, email, backupCodes } = await withTwoFactor();
    const useBackup = async () =>
      verifySignInCode(
        { code: backupCodes[0], backup: true },
        await passwordStep(email, false),
      );

    expect(await useBackup()).toEqual({ status: "signedIn" });
    expect(await useBackup()).toEqual({ status: "invalid" });
    expect(await signInEvents(userId)).toEqual([
      { diff: { twoFactor: "backupCode" } },
    ]);
  });

  // Better Auth takes five codes per password step and locks after ten wrong ones in a row (Audit 2).
  it("locks after ten wrong codes in a row, and records the lock once, as the system", async () => {
    const { userId, email, key } = await withTwoFactor();
    const right = totp(key);
    const wrong = `${right.slice(0, -1)}${(Number(right.at(-1)) + 5) % 10}`;
    for (const _challenge of [1, 2]) {
      const headers = await passwordStep(email, false);
      for (let code = 0; code < 5; code++) {
        expect(
          await verifySignInCode({ code: wrong, backup: false }, headers),
        ).toEqual({ status: "invalid" });
      }
    }
    for (const _again of [1, 2]) {
      expect(
        await verifySignInCode(
          { code: totp(key), backup: false },
          await passwordStep(email, false),
        ),
      ).toEqual({ status: "locked" });
    }

    const locks = await query(
      "select actor_id, diff from audit_events where entity_id = $1 and action = 'account.lockTwoFactor'",
      [userId],
    );
    expect(locks).toEqual([
      {
        actor_id: null,
        diff: { lockedUntil: expect.stringMatching(/^\d{4}-.+Z$/) },
      },
    ]);
  });

  const turnedOff = (userId: string) =>
    query(
      "select actor_id, ip from audit_events where entity_id = $1 and action = 'account.disableTwoFactor'",
      [userId],
    );

  it("is turned off for its owner by an admin: the password alone signs in, the secret is gone, and it is audited once (ADR-0014)", async () => {
    const { userId, email } = await withTwoFactor();
    const admin = await person();
    const change = {
      collegeId,
      actorId: admin.userId,
      ip: "10.0.16.1",
      userAgent: "integration-test",
    };

    expect(await turnOffTwoFactor(userId, change)).toBe("off");
    expect(await turnOffTwoFactor(userId, change)).toBe("notOn");

    expect(
      await query("select id from two_factors where user_id = $1", [userId]),
    ).toEqual([]);
    expect(await attempt({ identifier: email }, "10.0.16.1")).toEqual({
      status: "signedIn",
    });
    expect(await turnedOff(userId)).toEqual([
      { actor_id: admin.userId, ip: "10.0.16.1" },
    ]);
  });

  it("is turned off by its owner with the password typed again, which counts toward the lockout (ADR-0014)", async () => {
    // A session from before two-factor was on: once it is on, signing in asks for a code.
    const owner = async () => {
      const { userId, email } = await person();
      const device = await signedInDevice(email);
      await query("update users set two_factor_enabled = true where id = $1", [
        userId,
      ]);
      return { user: { userId, collegeId }, headers: device.headers };
    };

    const right = await owner();
    expect(
      await turnOffOwnTwoFactor(PASSWORD, right.user, right.headers),
    ).toEqual({ status: "off" });
    expect(await turnedOff(right.user.userId)).toEqual([
      { actor_id: right.user.userId, ip: null },
    ]);

    const guessing = await owner();
    const guess = () =>
      turnOffOwnTwoFactor("wrong-password", guessing.user, guessing.headers);
    for (let count = 0; count < 4; count++) {
      expect(await guess()).toEqual({ status: "wrongPassword" });
    }
    expect(await guess()).toEqual({ status: "locked", minutes: 15 });
    expect(
      await query("select two_factor_enabled from users where id = $1", [
        guessing.user.userId,
      ]),
    ).toEqual([{ two_factor_enabled: true }]);
  });
});

describe("signOut", () => {
  it("ends this device's session and audits it", async () => {
    const { userId, email } = await person();
    const device = await signedInDevice(email);

    await signOut({ userId, collegeId }, device.headers);

    expect(
      await query("select id from sessions where id = $1", [device.sessionId]),
    ).toEqual([]);
    expect(
      await query(
        "select actor_id, action from audit_events where entity_id = $1",
        [userId],
      ),
    ).toEqual([{ actor_id: userId, action: "session.signOut" }]);
  });
});

describe("a password typed again behind a session", () => {
  const changeWith = (
    currentPassword: string,
    user: { userId: string; sessionId: string },
    headers: Headers,
  ) =>
    changePassword(
      { currentPassword, newPassword: "a-new-long-passphrase" },
      { ...user, collegeId },
      headers,
    );

  it("counts toward the lockout: the attempt that reaches the threshold locks both identifiers and ends every session", async () => {
    const { userId, email, employeeNumber } = await person();
    const device = await signedInDevice(email);
    await signedInDevice(email);
    const user = { userId, sessionId: device.sessionId };

    for (let count = 0; count < 4; count++) {
      expect(await changeWith("wrong-password", user, device.headers)).toEqual({
        status: "wrongPassword",
      });
    }
    expect(await changeWith("wrong-password", user, device.headers)).toEqual({
      status: "locked",
      minutes: 15,
    });

    expect(
      await query("select id from sessions where user_id = $1", [userId]),
    ).toEqual([]);
    for (const identifier of [email, employeeNumber]) {
      expect(await attempt({ identifier }, "10.0.14.1")).toEqual({
        status: "locked",
        minutes: 15,
      });
    }
    expect(
      await query(
        "select actor_id, action from audit_events where entity_id = $1 and action = 'account.lock'",
        [userId],
      ),
    ).toEqual([{ actor_id: null, action: "account.lock" }]);
  });

  it("counts at two-factor setup too, and the right password starts the count again", async () => {
    const { userId, email } = await person();
    const device = await signedInDevice(email);
    const start = (password: string) =>
      startTwoFactorSetup(
        { password, issuer: "Test College" },
        { userId, collegeId },
        device.headers,
      );

    for (let count = 0; count < 4; count++) {
      expect(await start("wrong-password")).toEqual({
        status: "wrongPassword",
      });
    }
    expect(await start(PASSWORD)).toMatchObject({ status: "started" });
    for (let count = 0; count < 4; count++) {
      expect(await start("wrong-password")).toEqual({
        status: "wrongPassword",
      });
    }
  });

  it("refuses while guesses at the login page hold the lock, and leaves the person signed in", async () => {
    const { userId, email } = await person();
    const device = await signedInDevice(email);
    for (let index = 1; index <= 5; index++) {
      await attempt(
        { identifier: email, password: "wrong-password" },
        `10.0.15.${index}`,
      );
    }

    expect(
      await changeWith(
        PASSWORD,
        { userId, sessionId: device.sessionId },
        device.headers,
      ),
    ).toEqual({ status: "locked", minutes: 15 });
    expect(
      await query("select id from sessions where id = $1", [device.sessionId]),
    ).toEqual([{ id: device.sessionId }]);
  });
});

describe("reauthenticate", () => {
  const passwordEnteredAt = async (sessionId: string) =>
    (
      await query("select password_entered_at from sessions where id = $1", [
        sessionId,
      ])
    )[0].password_entered_at as Date;

  it("takes the sign-in's password for the setting's minutes, then asks again, and a right password starts the window again", async () => {
    const { userId, email } = await person();
    const device = await signedInDevice(email);
    const user = { userId, sessionId: device.sessionId, collegeId };
    const signedInAt = await passwordEnteredAt(device.sessionId);
    const after = (minutes: number) =>
      new Date(signedInAt.getTime() + minutes * MINUTE_MS);

    expect(
      await reauthenticate(undefined, user, device.headers, after(14)),
    ).toEqual({ status: "confirmed" });
    expect(
      await reauthenticate(undefined, user, device.headers, after(15)),
    ).toEqual({ status: "passwordRequired" });
    expect(
      await reauthenticate("wrong-password", user, device.headers, after(15)),
    ).toEqual({ status: "wrongPassword" });
    expect(
      await reauthenticate(PASSWORD, user, device.headers, after(15)),
    ).toEqual({ status: "confirmed" });
    expect(await passwordEnteredAt(device.sessionId)).toEqual(after(15));
    expect(
      await reauthenticate(undefined, user, device.headers, after(29)),
    ).toEqual({ status: "confirmed" });

    // The window is a setting.
    await store("auth.reauthMinutes", 60);
    expect(
      await reauthenticate(undefined, user, device.headers, after(74)),
    ).toEqual({ status: "confirmed" });
    await store("auth.reauthMinutes", 15);
  });

  it("counts a wrong password toward the lockout, which ends every session", async () => {
    const { userId, email } = await person();
    const device = await signedInDevice(email);
    const user = { userId, sessionId: device.sessionId, collegeId };
    const later = new Date(
      (await passwordEnteredAt(device.sessionId)).getTime() + 20 * MINUTE_MS,
    );

    for (let count = 0; count < 4; count++) {
      expect(
        await reauthenticate("wrong-password", user, device.headers, later),
      ).toEqual({ status: "wrongPassword" });
    }
    expect(
      await reauthenticate("wrong-password", user, device.headers, later),
    ).toEqual({ status: "locked", minutes: 15 });
    expect(
      await query("select id from sessions where user_id = $1", [userId]),
    ).toEqual([]);
  });
});

describe("a disabled account", () => {
  const change = (actorId: string) => ({
    collegeId,
    actorId,
    ip: "10.0.40.1",
    userAgent: "integration-test",
  });
  const disable = (userId: string, disabled: boolean, actorId = userId) =>
    getDb().transaction((tx) =>
      setAccountDisabled(userId, disabled, change(actorId), tx),
    );
  const events = async (userId: string) =>
    (
      await query(
        "select action, actor_id from audit_events where entity_id = $1 and action like 'account.%able' order by created_at, id",
        [userId],
      )
    ).map(({ action }) => action);

  it("ends every session, and audits disabling and enabling; the same state again writes nothing", async () => {
    const admin = await person();
    const { userId, email } = await person();
    const device = await signedInDevice(email);

    expect(await disable(userId, true, admin.userId)).toBe("saved");
    expect(
      await query("select id from sessions where id = $1", [device.sessionId]),
    ).toEqual([]);
    expect(await disable(userId, true, admin.userId)).toBe("unchanged");
    expect(await disable(userId, false, admin.userId)).toBe("saved");
    expect(await events(userId)).toEqual(["account.disable", "account.enable"]);
    expect(
      await getDb().transaction((tx) =>
        setAccountDisabled(
          userId,
          true,
          { ...change(admin.userId), collegeId: crypto.randomUUID() },
          tx,
        ),
      ),
    ).toBe("notFound");
  });

  it("says so at sign-in only to whoever typed its password; anyone else gets the usual answer, which counts", async () => {
    const { userId, employeeNumber } = await person();
    await disable(userId, true);
    const sessions = async () =>
      (await query("select id from sessions where user_id = $1", [userId]))
        .length;

    expect(await attempt({ identifier: employeeNumber }, "10.0.40.2")).toEqual({
      status: "disabled",
    });
    expect(
      await attempt(
        { identifier: employeeNumber, password: "a-wrong-password" },
        "10.0.40.2",
      ),
    ).toEqual({ status: "invalid" });
    expect(await sessions()).toBe(0);

    await disable(userId, false);
    expect(await attempt({ identifier: employeeNumber }, "10.0.40.2")).toEqual({
      status: "signedIn",
    });
  });

  it("signs nobody in through a session made as it was disabled, and ends that session", async () => {
    const { userId, email } = await person();
    const device = await signedInDevice(email);
    request.headers = device.headers;
    await query("update users set disabled_at = now() where id = $1", [userId]);

    expect(await getSessionUser()).toBeNull();
    expect(
      await query("select id from sessions where id = $1", [device.sessionId]),
    ).toEqual([]);
  });
});

describe("updatePerson and linkEmployeeNumber", () => {
  const change = (actorId: string) => ({
    collegeId,
    actorId,
    ip: "10.0.50.1",
  });
  const events = async (userId: string) =>
    await query(
      "select action, diff from audit_events where entity_id = $1 and action like 'person.%' order by created_at, id",
      [userId],
    );

  it("corrects the name and the email, records each changed field, and refuses another account's email", async () => {
    const admin = await person();
    const { userId, email, employeeNumber } = await person();
    const other = await person();

    await expect(
      updatePerson(
        userId,
        { name: "Sara Ali", email },
        change(admin.userId),
        getDb(),
      ),
    ).resolves.toEqual({ status: "saved" });
    await expect(
      updatePerson(
        userId,
        { name: "Sara Ali", email: other.email },
        change(admin.userId),
        getDb(),
      ),
    ).resolves.toEqual({ status: "emailTaken" });
    await expect(
      updatePerson(
        userId,
        { name: "Sara Ali", email },
        change(admin.userId),
        getDb(),
      ),
    ).resolves.toEqual({ status: "unchanged" });
    await expect(
      updatePerson(
        userId,
        { name: "Sara Ali", email: "sara.ali@college.example" },
        change(admin.userId),
        getDb(),
      ),
    ).resolves.toEqual({ status: "saved" });

    expect(await events(userId)).toEqual([
      {
        action: "person.update",
        diff: {
          from: { name: `Person ${employeeNumber}` },
          to: { name: "Sara Ali" },
        },
      },
      {
        action: "person.update",
        diff: {
          from: { email },
          to: { email: "sara.ali@college.example" },
        },
      },
    ]);
    expect(
      await attempt({ identifier: "Sara.Ali@college.example" }, "10.0.50.2"),
    ).toEqual({ status: "signedIn" });
  });

  it("links a new employee number, which the person then signs in with, and refuses one the college has", async () => {
    const admin = await person();
    const { userId, employeeNumber } = await person();
    const other = await person();

    await expect(
      linkEmployeeNumber(
        userId,
        other.employeeNumber,
        change(admin.userId),
        getDb(),
      ),
    ).resolves.toEqual({ status: "taken" });
    await expect(
      linkEmployeeNumber(userId, "4990001", change(admin.userId), getDb()),
    ).resolves.toEqual({ status: "saved" });
    await expect(
      linkEmployeeNumber(userId, "4990001", change(admin.userId), getDb()),
    ).resolves.toEqual({ status: "unchanged" });

    expect(await events(userId)).toEqual([
      {
        action: "person.linkEmployeeNumber",
        diff: {
          from: { employeeNumber },
          to: { employeeNumber: "4990001" },
        },
      },
    ]);
    expect(await attempt({ identifier: "4990001" }, "10.0.50.3")).toEqual({
      status: "signedIn",
    });
  });
});

describe("lockedAccounts", () => {
  it("finds the accounts whose email or employee number the lockout holds now", async () => {
    const byEmail = await person();
    const byNumber = await person();
    const neither = await person();
    for (let attempt_ = 0; attempt_ < 5; attempt_++) {
      await attempt(
        { identifier: byEmail.email, password: "a-wrong-password" },
        "10.0.60.1",
      );
      await attempt(
        { identifier: byNumber.employeeNumber, password: "a-wrong-password" },
        "10.0.60.2",
      );
    }
    await attempt(
      { identifier: neither.email, password: "a-wrong-password" },
      "10.0.60.3",
    );

    const locked = await lockedAccounts(collegeId, [
      byEmail,
      byNumber,
      neither,
    ]);
    expect([...locked].sort()).toEqual(
      [byEmail.userId, byNumber.userId].sort(),
    );
    expect(
      await lockedAccounts(
        collegeId,
        [byEmail],
        getDb(),
        new Date(Date.now() + 16 * MINUTE_MS),
      ),
    ).toEqual(new Set());
  });
});
