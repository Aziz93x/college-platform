import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { seedBase } from "../../db/seed/base.ts";
import {
  getSetting,
  resetSetting,
  setSetting,
} from "../../src/modules/settings/index.ts";
import { logger } from "../../src/platform/logging/logger.ts";
import { createTestDatabase } from "./support/database.ts";

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let collegeId: string;
let otherCollegeId: string;

beforeAll(async () => {
  database = await createTestDatabase();
  collegeId = await seedBase(database.db, {
    name: "Test College",
    shortName: "TC",
  });
  const { rows } = await database.pool.query(
    "insert into colleges (name, short_name) values ('Other College', 'OC') returning id",
  );
  otherCollegeId = rows[0].id;
});

afterAll(() => database?.drop());

async function store(college: string, key: string, value: unknown) {
  await database.pool.query(
    `insert into settings (college_id, key, value) values ($1, $2, $3)
     on conflict (college_id, key) do update set value = excluded.value`,
    [college, key, JSON.stringify(value)],
  );
}

const timeZone = () =>
  getSetting("locale.timeZone", { collegeId }, database.db);

it("returns the registered default while the college has no stored value", async () => {
  // Rows for another college or another key do not count.
  await store(otherCollegeId, "locale.timeZone", "Asia/Dubai");
  await store(collegeId, "locale.other", "Europe/London");

  await expect(timeZone()).resolves.toBe("Asia/Riyadh");
});

it("returns the stored value once one exists", async () => {
  await store(collegeId, "locale.timeZone", "Asia/Dubai");

  await expect(timeZone()).resolves.toBe("Asia/Dubai");
});

// One bad row, such as one a later step's stricter schema refuses, must not take down every page.
it("falls back to the default when the stored value fails the schema, and logs the key, never the value", async () => {
  const logged = vi.spyOn(logger, "error").mockImplementation(() => {});
  await store(collegeId, "locale.timeZone", "Mars/Olympus");

  await expect(timeZone()).resolves.toBe("Asia/Riyadh");
  expect(logged).toHaveBeenCalledWith(
    expect.objectContaining({ setting: "locale.timeZone" }),
    expect.any(String),
  );
  expect(JSON.stringify(logged.mock.calls)).not.toContain("Mars/Olympus");
  logged.mockRestore();
});

// "ar" is the only language with a catalog so far, so the stored value equals the default;
// the refused value shows the row is read.
const language = () =>
  getSetting("locale.language", { collegeId }, database.db);

it("returns the default language, then the stored one, and the default again for a language the schema refuses", async () => {
  const logged = vi.spyOn(logger, "error").mockImplementation(() => {});
  await expect(language()).resolves.toBe("ar");

  await store(collegeId, "locale.language", "ar");
  await expect(language()).resolves.toBe("ar");
  expect(logged).not.toHaveBeenCalled();

  await store(collegeId, "locale.language", "xx");
  await expect(language()).resolves.toBe("ar");
  expect(logged).toHaveBeenCalledOnce();
  logged.mockRestore();
});

describe("setSetting and resetSetting", () => {
  let actorId: string;
  beforeAll(async () => {
    actorId = (
      await database.pool.query("select gen_random_uuid()::text as id")
    ).rows[0].id;
  });
  const change = () => ({
    collegeId,
    actorId,
    ip: "10.0.20.1",
    userAgent: "integration-test",
  });
  const events = async (key: string) =>
    (
      await database.pool.query(
        "select actor_id, action, diff, ip from audit_events where entity_type = 'setting' and entity_id = $1 order by created_at, id",
        [key],
      )
    ).rows;
  const row = async (key: string) =>
    (
      await database.pool.query(
        "select value, version from settings where college_id = $1 and key = $2",
        [collegeId, key],
      )
    ).rows[0];

  // The screen's save calls setSetting; the next request reads the value through getSetting.
  it("stores a value that passes the schema, which getSetting returns from then on, and audits it with the value before and after", async () => {
    await expect(
      setSetting("auth.lockoutMinutes", 30, change(), database.db),
    ).resolves.toEqual({ status: "saved", value: 30 });
    await expect(
      getSetting("auth.lockoutMinutes", { collegeId }, database.db),
    ).resolves.toBe(30);

    await setSetting("auth.lockoutMinutes", 45, change(), database.db);
    await expect(
      getSetting("auth.lockoutMinutes", { collegeId }, database.db),
    ).resolves.toBe(45);
    expect(await row("auth.lockoutMinutes")).toEqual({ value: 45, version: 2 });
    expect(await events("auth.lockoutMinutes")).toEqual([
      {
        actor_id: actorId,
        action: "setting.update",
        diff: { from: 15, to: 30 },
        ip: "10.0.20.1",
      },
      {
        actor_id: actorId,
        action: "setting.update",
        diff: { from: 30, to: 45 },
        ip: "10.0.20.1",
      },
    ]);
  });

  it.each([
    ["a number past the schema's limit", "auth.lockoutMinutes", 1441],
    ["a fraction where a whole number is due", "auth.sessionHours", 1.5],
    ["text where a yes or no is due", "pilot.banner", "yes"],
    ["a choice the schema does not list", "locale.weekStart", "someday"],
    ["a time zone Intl does not know", "locale.timeZone", "Mars/Olympus"],
    ["an empty name", "platform.name", "   "],
    ["a list with the same type twice", "files.acceptedTypes", ["pdf", "PDF"]],
  ] as const)("refuses %s, and stores and audits nothing", async (_name, key, value) => {
    // Tests above stored some of these keys: their rows and events stay as they were.
    const [rowBefore, eventsBefore] = [await row(key), await events(key)];
    await expect(
      setSetting(key, value, change(), database.db),
    ).resolves.toEqual({ status: "invalid" });
    expect(await row(key)).toEqual(rowBefore);
    expect(await events(key)).toEqual(eventsBefore);
  });

  it("changes and audits nothing for the value already in force", async () => {
    await expect(
      setSetting("auth.idleMinutes", 60, change(), database.db),
    ).resolves.toEqual({ status: "unchanged", value: 60 });
    expect(await row("auth.idleMinutes")).toBeUndefined();
    expect(await events("auth.idleMinutes")).toEqual([]);
  });

  it("stores the value its schema gives, and null for a nullable text, which brings back the catalog's words", async () => {
    await setSetting(
      "files.acceptedTypes",
      [" PDF ", "Jpg"],
      change(),
      database.db,
    );
    expect((await row("files.acceptedTypes")).value).toEqual(["pdf", "jpg"]);

    await setSetting("pilot.bannerText", "Trial run", change(), database.db);
    await setSetting("pilot.bannerText", null, change(), database.db);
    expect(await row("pilot.bannerText")).toEqual({ value: null, version: 2 });
    await expect(
      getSetting("pilot.bannerText", { collegeId }, database.db),
    ).resolves.toBeNull();
  });

  it("resets to the default by removing the value, and audits it; with nothing stored, it changes nothing", async () => {
    await setSetting("auth.sessionHours", 8, change(), database.db);
    await expect(
      resetSetting("auth.sessionHours", change(), database.db),
    ).resolves.toEqual({ status: "reset", value: 12 });
    expect(await row("auth.sessionHours")).toBeUndefined();
    await expect(
      getSetting("auth.sessionHours", { collegeId }, database.db),
    ).resolves.toBe(12);

    await expect(
      resetSetting("auth.sessionHours", change(), database.db),
    ).resolves.toEqual({ status: "unchanged", value: 12 });
    expect(
      (await events("auth.sessionHours")).map((e) => [e.action, e.diff]),
    ).toEqual([
      ["setting.update", { from: 12, to: 8 }],
      ["setting.reset", { from: 8, to: 12 }],
    ]);
  });

  // Two changes at once (Audit 3). The first is held after it writes its value, before its audit
  // event, until the second waits on the database too; then both go on. Without one lock per key,
  // the second would read the value from before the first.
  async function atOnce(
    first: () => Promise<unknown>,
    second: () => Promise<unknown>,
  ) {
    const waiting = (count: number) =>
      expect
        .poll(
          async () =>
            (
              await database.pool.query(
                "select count(*)::int as count from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'",
              )
            ).rows[0].count,
          { timeout: 5_000 },
        )
        .toBe(count);
    const blocker = await database.pool.connect();
    try {
      await blocker.query("begin");
      await blocker.query("lock table audit_events in exclusive mode");
      const one = first();
      await waiting(1);
      const two = second();
      await waiting(2);
      await blocker.query("commit");
      await Promise.all([one, two]);
    } finally {
      await blocker.query("rollback");
      blocker.release();
    }
  }

  it("runs two saves at once one after the other, so each records the value it changed", async () => {
    await atOnce(
      () => setSetting("auth.lockoutThreshold", 8, change(), database.db),
      () => setSetting("auth.lockoutThreshold", 9, change(), database.db),
    );
    expect(
      (await events("auth.lockoutThreshold")).map(({ diff }) => diff),
    ).toEqual([
      { from: 5, to: 8 },
      { from: 8, to: 9 },
    ]);
  });

  it("builds a value from the one in force when given a function, so two roles' page orders saved at once both stay", async () => {
    await atOnce(
      () =>
        setSetting(
          "navigation.order",
          (orders) => ({ ...orders, head: ["today", "roles"] }),
          change(),
          database.db,
        ),
      () =>
        setSetting(
          "navigation.order",
          (orders) => ({ ...orders, trainer: ["settings", "today"] }),
          change(),
          database.db,
        ),
    );
    expect((await row("navigation.order")).value).toEqual({
      head: ["today", "roles"],
      trainer: ["settings", "today"],
    });
  });

  it("runs a reset at the same time as a save after it, so the default is in force", async () => {
    await atOnce(
      () => setSetting("auth.reauthMinutes", 20, change(), database.db),
      () => resetSetting("auth.reauthMinutes", change(), database.db),
    );
    expect(await row("auth.reauthMinutes")).toBeUndefined();
    expect(
      (await events("auth.reauthMinutes")).map((e) => [e.action, e.diff]),
    ).toEqual([
      ["setting.update", { from: 15, to: 20 }],
      ["setting.reset", { from: 20, to: 15 }],
    ]);
  });
});
