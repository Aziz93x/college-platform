import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { seedBase } from "../../db/seed/base.ts";
import {
  changePassword,
  createAccount,
  getAuth,
  getSessionUser,
  resetPassword,
  type SignInInput,
  signIn,
} from "../../src/modules/identity/index.ts";
import { getDb } from "../../src/platform/db/client.ts";
import { createSharedTestDatabase } from "./support/database.ts";

// The request getSessionUser reads, and a cookie store for Better Auth's Next.js plugin, which
// writes the cookies it sets through next/headers.
const request = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({
  headers: async () => request.headers,
  cookies: async () => ({ set: () => {} }),
}));

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

// A signed-in device: the cookie Better Auth sets, as the browser sends it back.
async function signedInDevice(email: string) {
  const { headers } = await getAuth().api.signInEmail({
    body: { email, password: PASSWORD, rememberMe: true },
    returnHeaders: true,
  });
  const cookie = headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");
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

    expect(await attempt({ identifier: "999999" }, "10.0.2.1")).toEqual({
      status: "invalid",
    });
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

  it("locks the account after the threshold of wrong passwords in a row, from any address, and audits the lock", async () => {
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

  describe("with five attempts per account and address", () => {
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
