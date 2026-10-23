import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { holidayRules, holidayYears, seedBase } from "../../db/seed/base.ts";
import {
  addMembership,
  findRole,
  loadAccess,
} from "../../src/modules/access/index.ts";
import { createAccount } from "../../src/modules/identity/index.ts";
import {
  activateTerm,
  addCalendarEvent,
  type CalendarSettings,
  calendarOf,
  calendarSettings,
  closeTerm,
  createTerm,
  estimateHolidays,
  findTerm,
  listTermCalendars,
  openNextTerm,
  removeCalendarEvent,
  saveExamPeriods,
  strandedBySetting,
  termEndsOn,
  termWeeks,
  updateCalendarEvent,
  updateHoliday,
  updateTerm,
  weekOf,
} from "../../src/modules/terms/index.ts";
import { lockCollege } from "../../src/platform/db/college-lock.ts";
import { createTestDatabase } from "./support/database.ts";
import { recording } from "./support/plans.ts";

// The vice-dean's terms (Step 13): an 18-week term with its holidays, events of the college's own,
// grade deadline and exam periods by week number (the owner's notes, 21 October 2026), one active
// term per college, the next term opened from a term's calendar, and a role held in one term.
let database: Awaited<ReturnType<typeof createTestDatabase>>;
let collegeId: string;
let otherCollegeId: string;
let electrical: string;
let settings: CalendarSettings;
const people: Record<string, string> = {};

const query = async (text: string, values: unknown[] = []) =>
  (await database.pool.query(text, values)).rows;

const change = () => ({ collegeId, actorId: people.viceDean });

const roleId = async (key: string) =>
  (
    await query("select id from roles where college_id = $1 and key = $2", [
      collegeId,
      key,
    ])
  )[0].id as string;

// The second term of 1447: 18 weeks from Sunday 4 January 2026, trained through Ramadan, with a
// two-week Eid al-Fitr break, a week of field training in the middle, a projects fair over its last
// two weeks, and the grades due on the last Thursday.
const SECOND_TERM = {
  name: "الفصل التدريبي الثاني 1447",
  startsOn: "2026-01-04",
  weeks: 18,
};
const CALENDAR = [
  {
    kind: "holiday",
    title: "يوم التأسيس",
    startsOn: "2026-02-22",
    endsOn: "2026-02-22",
  },
  {
    kind: "custom",
    title: "أسبوع التدريب الميداني",
    startsOn: "2026-03-01",
    endsOn: "2026-03-05",
  },
  {
    kind: "holiday",
    title: "إجازة عيد الفطر",
    startsOn: "2026-03-15",
    endsOn: "2026-03-28",
  },
  {
    kind: "custom",
    title: "معرض مشاريع التخرج",
    startsOn: "2026-05-10",
    endsOn: "2026-05-21",
  },
  {
    kind: "gradeDeadline",
    title: "آخر موعد لرصد الدرجات",
    startsOn: "2026-05-21",
    endsOn: "2026-05-21",
  },
] as const;
// Its exam periods as the owner's canvas sets them (21 October 2026), by week number.
const PERIODS = [
  { type: "first-periodic", from: 5, to: 6 },
  { type: "second-periodic", from: 11, to: 12 },
  { type: "practical-final", from: 16, to: 16 },
  { type: "theoretical-final", from: 17, to: 18 },
];

async function termWithCalendar(name: string) {
  const created = await createTerm(
    { ...SECOND_TERM, name },
    change(),
    database.db,
  );
  if (created.status !== "created") throw new Error(created.status);
  for (const event of CALENDAR) {
    const added = await addCalendarEvent(
      created.id,
      event,
      change(),
      settings,
      database.db,
    );
    if (added.status !== "saved") throw new Error(added.status);
  }
  return created.id;
}

beforeAll(async () => {
  database = await createTestDatabase();
  collegeId = await seedBase(database.db, {
    name: "Test College",
    shortName: "TC",
  });
  [{ id: otherCollegeId }] = await query(
    "insert into colleges (name, short_name) values ('Other', 'O') returning id",
  );
  [{ id: electrical }] = await query(
    "insert into departments (college_id, name, short_name) values ($1, 'Electrical', 'Elec') returning id",
    [collegeId],
  );
  for (const name of ["viceDean", "hind"]) {
    people[name] = await database.db.transaction(
      async (tx) =>
        (
          await createAccount(
            {
              collegeId,
              name,
              email: `${name}@college.example`,
              employeeNumber: `5${Object.keys(people).length}0001`,
            },
            tx,
            `password-${name}`,
          )
        ).userId,
    );
  }
  settings = await calendarSettings(collegeId, database.db);
});

afterAll(() => database?.drop());

describe("a term and its calendar", () => {
  it("takes an 18-week term with its holidays, events and grade deadline, and counts on past the Eid break", async () => {
    const id = await termWithCalendar("الفصل الأول");
    const term = await findTerm(collegeId, id, database.db);
    if (!term) throw new Error("no term");
    expect(term).toMatchObject({ ...SECOND_TERM, name: "الفصل الأول" });
    expect(term.status).toBe("draft");
    expect(term.events.map(({ title }) => title)).toEqual(
      CALENDAR.map(({ title }) => title),
    );

    const calendar = calendarOf(term, term.events, settings);
    const weeks = termWeeks(calendar);
    expect(weeks.filter((week) => week.number !== null)).toHaveLength(18);
    expect(weeks.filter((week) => week.number === null)).toEqual([
      expect.objectContaining({ startsOn: "2026-03-15", holiday: true }),
      expect.objectContaining({ startsOn: "2026-03-22", holiday: true }),
    ]);
    expect(weekOf(calendar, "2026-03-01")?.number).toBe(9);
    expect(weekOf(calendar, "2026-05-10")?.number).toBe(17);
    expect(termEndsOn(calendar)).toBe("2026-05-23");

    expect(
      await query(
        "select action, actor_id, diff from audit_events where entity_type = 'term' and entity_id = $1 order by created_at, id",
        [id],
      ),
    ).toEqual([
      {
        action: "term.create",
        actor_id: people.viceDean,
        diff: { to: { ...SECOND_TERM, name: "الفصل الأول" } },
      },
      ...CALENDAR.map((event) => ({
        action: "calendarEvent.create",
        actor_id: people.viceDean,
        diff: { to: event },
      })),
    ]);
  });

  it("refuses an event outside the term, and a change that leaves one outside it", async () => {
    const id = await termWithCalendar("Term B");
    const outside = (title: string, startsOn: string, endsOn = startsOn) =>
      addCalendarEvent(
        id,
        { kind: "custom", title, startsOn, endsOn },
        change(),
        settings,
        database.db,
      );
    await expect(outside("before", "2026-01-03")).resolves.toEqual({
      status: "eventsOutside",
      events: ["before"],
    });
    await expect(outside("after", "2026-05-20", "2026-05-24")).resolves.toEqual(
      { status: "eventsOutside", events: ["after"] },
    );
    // Two weeks fewer leave the last two weeks' fair and deadline out.
    await expect(
      updateTerm(
        id,
        { ...SECOND_TERM, name: "Term B", weeks: 16 },
        change(),
        settings,
        database.db,
      ),
    ).resolves.toEqual({
      status: "eventsOutside",
      events: ["معرض مشاريع التخرج", "آخر موعد لرصد الدرجات"],
    });
    // So does the Eid break taken away: the term would end two weeks sooner.
    const term = await findTerm(collegeId, id, database.db);
    const eid = term?.events.find(({ title }) => title === "إجازة عيد الفطر");
    if (!eid) throw new Error("no Eid break");
    await expect(
      removeCalendarEvent(id, eid.id, change(), settings, database.db),
    ).resolves.toEqual({
      status: "eventsOutside",
      events: ["معرض مشاريع التخرج", "آخر موعد لرصد الدرجات"],
    });
    await expect(
      removeCalendarEvent(
        id,
        crypto.randomUUID(),
        change(),
        settings,
        database.db,
      ),
    ).resolves.toEqual({ status: "eventNotFound" });
    // The same name, in any case of its Latin letters, is another term's.
    await expect(
      createTerm({ ...SECOND_TERM, name: "term b" }, change(), database.db),
    ).resolves.toEqual({ status: "nameTaken" });
  });

  it("records what an edit changed, and what a removal took", async () => {
    const id = await termWithCalendar("Term C");
    const term = await findTerm(collegeId, id, database.db);
    const training = term?.events.find(
      ({ title }) => title === CALENDAR[1].title,
    );
    if (!training) throw new Error("no field training");
    await expect(
      updateCalendarEvent(
        id,
        training.id,
        { ...CALENDAR[1], endsOn: "2026-03-04" },
        change(),
        settings,
        database.db,
      ),
    ).resolves.toEqual({ status: "saved" });
    await expect(
      removeCalendarEvent(id, training.id, change(), settings, database.db),
    ).resolves.toEqual({ status: "saved" });
    await expect(
      updateTerm(
        id,
        { ...SECOND_TERM, name: "Term C2" },
        change(),
        settings,
        database.db,
      ),
    ).resolves.toEqual({ status: "saved" });
    expect(
      await query(
        `select action, diff from audit_events where entity_id = $1
         and action in ('calendarEvent.update', 'calendarEvent.delete', 'term.update') order by created_at, id`,
        [id],
      ),
    ).toEqual([
      {
        action: "calendarEvent.update",
        diff: {
          from: { title: "أسبوع التدريب الميداني", endsOn: "2026-03-05" },
          to: { endsOn: "2026-03-04" },
        },
      },
      {
        action: "calendarEvent.delete",
        diff: { from: { ...CALENDAR[1], endsOn: "2026-03-04" } },
      },
      {
        action: "term.update",
        diff: { from: { name: "Term C" }, to: { name: "Term C2" } },
      },
    ]);
  });
});

describe("the active term and the next one", () => {
  it("keeps one active term per college, opens the next term from a term's calendar, and closes the old one when the next becomes active", async () => {
    const first = await termWithCalendar("الفصل الثاني 1447");
    await saveExamPeriods(first, PERIODS, change(), database.db);
    await expect(activateTerm(first, change(), database.db)).resolves.toEqual({
      status: "activated",
    });
    await expect(activateTerm(first, change(), database.db)).resolves.toEqual({
      status: "notDraft",
    });

    // The next term: the events and the deadline at the same places in its weeks, the exam periods
    // in the same weeks, and the holidays left behind for the vice-dean to enter.
    const next = await openNextTerm(
      first,
      { name: "الفصل الأول 1448", startsOn: "2026-08-23", weeks: 18 },
      change(),
      settings,
      database.db,
    );
    if (next.status !== "created") throw new Error(next.status);
    expect(next).toMatchObject({ copied: 3, periods: 4 });
    const opened = await findTerm(collegeId, next.id, database.db);
    expect(opened?.status).toBe("draft");
    expect(opened?.periods).toEqual(PERIODS);
    expect(
      opened?.events.map(({ kind, title, startsOn, endsOn }) => ({
        kind,
        title,
        startsOn,
        endsOn,
      })),
    ).toEqual([
      // Week 9, Sunday to Thursday.
      { ...CALENDAR[1], startsOn: "2026-10-18", endsOn: "2026-10-22" },
      // Weeks 17 and 18.
      { ...CALENDAR[3], startsOn: "2026-12-13", endsOn: "2026-12-24" },
      { ...CALENDAR[4], startsOn: "2026-12-24", endsOn: "2026-12-24" },
    ]);
    // A shorter term takes only what falls in its weeks.
    const shorter = await openNextTerm(
      first,
      { name: "Summer", startsOn: "2026-06-07", weeks: 9 },
      change(),
      settings,
      database.db,
    );
    // ...and every exam period, which a period past its last week keeps from becoming active until the
    // vice-dean moves it.
    if (shorter.status !== "created") throw new Error(shorter.status);
    expect(shorter).toMatchObject({ copied: 1, periods: 4 });
    await expect(
      activateTerm(shorter.id, change(), database.db),
    ).resolves.toEqual({
      status: "periodProblems",
      periods: [
        "الاختبارات الدورية الثانية",
        "الاختبارات النهائية العملية",
        "الاختبارات النهائية النظرية",
      ],
    });

    // The next term made active closes the one before it.
    await expect(activateTerm(next.id, change(), database.db)).resolves.toEqual(
      { status: "activated", closed: "الفصل الثاني 1447" },
    );
    expect(
      await query(
        "select name, status from terms where id = any($1) order by starts_on",
        [[first, next.id]],
      ),
    ).toEqual([
      { name: "الفصل الثاني 1447", status: "closed" },
      { name: "الفصل الأول 1448", status: "active" },
    ]);
    expect(
      await query(
        `select action, entity_id, diff from audit_events
         where action in ('term.activate', 'term.close') order by created_at, id`,
      ),
    ).toEqual([
      {
        action: "term.activate",
        entity_id: first,
        diff: { from: { status: "draft" }, to: { status: "active" } },
      },
      {
        action: "term.close",
        entity_id: first,
        diff: { from: { status: "active" }, to: { status: "closed" } },
      },
      {
        action: "term.activate",
        entity_id: next.id,
        diff: { from: { status: "draft" }, to: { status: "active" } },
      },
    ]);
    expect(
      (
        await query(
          "select diff from audit_events where action = 'term.create' and entity_id = $1",
          [next.id],
        )
      )[0].diff,
    ).toEqual({
      to: {
        name: "الفصل الأول 1448",
        startsOn: "2026-08-23",
        weeks: 18,
        from: "الفصل الثاني 1447",
        copied: 3,
        periods: 4,
      },
    });

    // The database holds one active term per college, whatever a query forgets.
    await expect(
      query(
        "insert into terms (college_id, name, starts_on, weeks, status) values ($1, 'x', '2027-01-03', 18, 'active')",
        [collegeId],
      ),
    ).rejects.toMatchObject({ code: "23505" });

    // A closed term is kept as it is.
    await expect(
      updateTerm(first, SECOND_TERM, change(), settings, database.db),
    ).resolves.toEqual({ status: "closed" });
    await expect(
      addCalendarEvent(first, CALENDAR[0], change(), settings, database.db),
    ).resolves.toEqual({ status: "closed" });
    await expect(closeTerm(first, change(), database.db)).resolves.toEqual({
      status: "notActive",
    });
    await expect(closeTerm(next.id, change(), database.db)).resolves.toEqual({
      status: "closed",
    });
  });
});

describe("a role held in one term", () => {
  it("gives its keys only while its term is the active one", async () => {
    const head = await roleId("head");
    const created = await Promise.all(
      ["Spring", "Autumn"].map((name) =>
        createTerm({ ...SECOND_TERM, name }, change(), database.db),
      ),
    );
    const [spring, autumn] = created.map((result) => {
      if (result.status !== "created") throw new Error(result.status);
      return result.id;
    });
    const added = await addMembership(
      {
        userId: people.hind,
        roleId: head,
        departmentId: electrical,
        termId: spring,
      },
      change(),
      database.db,
    );
    if (added.status !== "added") throw new Error(added.status);
    // Once in each term: the same role and department in another term is another membership.
    await expect(
      addMembership(
        {
          userId: people.hind,
          roleId: head,
          departmentId: electrical,
          termId: spring,
        },
        change(),
        database.db,
      ),
    ).resolves.toEqual({ status: "exists" });
    expect((await findRole(collegeId, head, database.db))?.members).toEqual([
      expect.objectContaining({ userId: people.hind, term: "Spring" }),
    ]);
    expect(
      (
        await query(
          "select diff from audit_events where action = 'membership.create' and entity_id = $1",
          [added.id],
        )
      )[0].diff,
    ).toEqual({
      to: {
        userId: people.hind,
        role: "head",
        departmentId: electrical,
        termId: spring,
      },
    });

    const holds = async () =>
      (await loadAccess(people.hind, collegeId, database.db)).grants.some(
        (grant) =>
          grant.permission === "sections.transfer" &&
          grant.departmentId === electrical,
      );
    // A draft term gives nothing yet; the active term, its keys; closed, nothing again.
    expect(await holds()).toBe(false);
    await activateTerm(spring, change(), database.db);
    expect(await holds()).toBe(true);
    await activateTerm(autumn, change(), database.db);
    expect(await holds()).toBe(false);

    // A closed term takes no new member, the system role is held in every term, and another
    // college's term is none of this one's.
    await expect(
      addMembership(
        {
          userId: people.hind,
          roleId: head,
          departmentId: null,
          termId: spring,
        },
        change(),
        database.db,
      ),
    ).resolves.toEqual({ status: "termClosed" });
    const [{ id: admin }] = await query(
      "select id from roles where college_id = $1 and system",
      [collegeId],
    );
    await expect(
      addMembership(
        {
          userId: people.hind,
          roleId: admin,
          departmentId: null,
          termId: autumn,
        },
        change(),
        database.db,
      ),
    ).resolves.toEqual({ status: "everyTerm" });
    const [{ id: elsewhere }] = await query(
      "insert into terms (college_id, name, starts_on, weeks) values ($1, 'Elsewhere', '2026-01-04', 18) returning id",
      [otherCollegeId],
    );
    await expect(
      addMembership(
        {
          userId: people.hind,
          roleId: head,
          departmentId: null,
          termId: elsewhere,
        },
        change(),
        database.db,
      ),
    ).resolves.toEqual({ status: "notFound" });
  });
});

describe("the college's holidays (ADR-0018)", () => {
  const breaksOf = async (year: number) =>
    query(
      `select id, key, to_char(starts_on, 'YYYY-MM-DD') as "startsOn",
         to_char(ends_on, 'YYYY-MM-DD') as "endsOn", adjusted
       from holidays where college_id = $1 and hijri_year = $2 order by starts_on`,
      [collegeId, year],
    );

  // 1448's holiday of a key.
  const breakOf = async (key: string) => {
    const found = (await breaksOf(1448)).find((each) => each.key === key);
    if (!found) throw new Error(`no ${key}`);
    return found;
  };

  it("are seeded for this Hijri year and the nine after it, once", async () => {
    expect(holidayYears("2026-10-22")).toEqual([
      1448, 1449, 1450, 1451, 1452, 1453, 1454, 1455, 1456, 1457,
    ]);
    const seeded = await query(
      "select distinct hijri_year from holidays where college_id = $1 order by 1",
      [collegeId],
    );
    expect(seeded.map(({ hijri_year }) => hijri_year)).toEqual(holidayYears());
    const before = await query("select count(*)::int as n from holidays");
    await seedBase(database.db, { name: "Test College", shortName: "TC" });
    expect(await query("select count(*)::int as n from holidays")).toEqual(
      before,
    );
    // 1448's, whatever today is: the estimate of each, in whole weeks.
    await estimateHolidays(collegeId, holidayRules, [1448], database.db);
    expect(await breaksOf(1448)).toEqual([
      {
        id: expect.any(String),
        key: "founding-day",
        startsOn: "2027-02-22",
        endsOn: "2027-02-22",
        adjusted: false,
      },
      {
        id: expect.any(String),
        key: "eid-al-fitr",
        startsOn: "2027-02-26",
        endsOn: "2027-03-13",
        adjusted: false,
      },
      {
        id: expect.any(String),
        key: "eid-al-adha",
        startsOn: "2027-05-07",
        endsOn: "2027-05-22",
        adjusted: false,
      },
    ]);
  });

  it("are counted by every term they fall in, and the next term takes its days past them", async () => {
    const created = await createTerm(
      { name: "الفصل الثاني 1448", startsOn: "2027-01-10", weeks: 18 },
      change(),
      database.db,
    );
    if (created.status !== "created") throw new Error(created.status);
    const term = await findTerm(collegeId, created.id, database.db);
    if (!term) throw new Error("no term");
    const calendar = calendarOf(term, term.events, settings, term.breaks);
    // Two weeks of each break go without a number; the term runs four weeks longer.
    expect(termWeeks(calendar).filter((week) => week.number === null)).toEqual([
      expect.objectContaining({ startsOn: "2027-02-28" }),
      expect.objectContaining({ startsOn: "2027-03-07" }),
      expect.objectContaining({ startsOn: "2027-05-09" }),
      expect.objectContaining({ startsOn: "2027-05-16" }),
    ]);
    expect(termEndsOn(calendar)).toBe("2027-06-12");

    // A term of 1447 opened into it: its field training, in week 9, lands in week 9 past the Eid
    // break.
    const source = await termWithCalendar("الفصل الثاني 1447 للنقل");
    const next = await openNextTerm(
      source,
      { name: "الفصل الثاني 1448 للنقل", startsOn: "2027-01-10", weeks: 18 },
      change(),
      settings,
      database.db,
    );
    if (next.status !== "created") throw new Error(next.status);
    const opened = await findTerm(collegeId, next.id, database.db);
    expect(
      opened?.events.find(({ title }) => title === CALENDAR[1].title),
    ).toMatchObject({ startsOn: "2027-03-21", endsOn: "2027-03-25" });
  });

  it("are adjusted by the vice-dean, for every term at once, until they begin", async () => {
    const fitr = await breakOf("eid-al-fitr");
    const today = "2026-10-22";
    await expect(
      updateHoliday(
        fitr.id,
        { startsOn: "2027-02-19", endsOn: "2027-03-13" },
        change(),
        today,
        settings,
        database.db,
      ),
    ).resolves.toEqual({ status: "saved" });
    expect(await breakOf("eid-al-fitr")).toMatchObject({
      startsOn: "2027-02-19",
      adjusted: true,
    });
    // The term of 1448 skips the week the break now takes, and ends a week later.
    const [{ id }] = await query(
      "select id from terms where name = 'الفصل الثاني 1448'",
    );
    const term = await findTerm(collegeId, id, database.db);
    if (!term) throw new Error("no term");
    expect(
      termEndsOn(calendarOf(term, term.events, settings, term.breaks)),
    ).toBe("2027-06-19");
    expect(
      (
        await query(
          "select actor_id, diff from audit_events where action = 'holiday.update'",
        )
      )[0],
    ).toEqual({
      actor_id: people.viceDean,
      diff: {
        from: {
          name: "إجازة رمضان وعيد الفطر",
          hijriYear: 1448,
          startsOn: "2027-02-26",
          endsOn: "2027-03-13",
        },
        to: {
          name: "إجازة رمضان وعيد الفطر",
          hijriYear: 1448,
          startsOn: "2027-02-19",
          endsOn: "2027-03-13",
        },
      },
    });
    // The same days again change nothing; a day that has passed, or a break begun, is refused.
    const days = { startsOn: "2027-02-19", endsOn: "2027-03-13" };
    await expect(
      updateHoliday(fitr.id, days, change(), today, settings, database.db),
    ).resolves.toEqual({ status: "unchanged" });
    await expect(
      updateHoliday(
        fitr.id,
        { startsOn: "2026-10-22", endsOn: "2027-03-13" },
        change(),
        today,
        settings,
        database.db,
      ),
    ).resolves.toEqual({ status: "past" });
    await expect(
      updateHoliday(
        fitr.id,
        days,
        change(),
        "2027-02-19",
        settings,
        database.db,
      ),
    ).resolves.toEqual({ status: "begun" });
    await expect(
      updateHoliday(
        fitr.id,
        days,
        { ...change(), collegeId: otherCollegeId },
        today,
        settings,
        database.db,
      ),
    ).resolves.toEqual({ status: "notFound" });
  });

  it("are not moved to days that would leave a term's events outside it (Audit 5)", async () => {
    // A fair in the last week of the term of 1448, which ends on 19 June past both breaks.
    const [{ id }] = await query(
      "select id from terms where name = 'الفصل الثاني 1448'",
    );
    const finals = {
      kind: "custom" as const,
      title: "Fair",
      startsOn: "2027-06-13",
      endsOn: "2027-06-17",
    };
    await expect(
      addCalendarEvent(id, finals, change(), settings, database.db),
    ).resolves.toMatchObject({ status: "saved" });
    // Eid al-Adha's break shorter by its first week: the term would end on 12 June.
    const adha = await breakOf("eid-al-adha");
    await expect(
      updateHoliday(
        adha.id,
        { startsOn: "2027-05-12", endsOn: adha.endsOn },
        change(),
        "2026-10-22",
        settings,
        database.db,
      ),
    ).resolves.toEqual({
      status: "eventsOutside",
      term: "الفصل الثاني 1448",
      events: ["Fair"],
    });
    expect(await breakOf("eid-al-adha")).toMatchObject({
      startsOn: adha.startsOn,
      adjusted: false,
    });
  });

  it("are approved by the vice-dean as estimated, once, in the log", async () => {
    const adha = await breakOf("eid-al-adha");
    const days = { startsOn: adha.startsOn, endsOn: adha.endsOn };
    await expect(
      updateHoliday(
        adha.id,
        days,
        change(),
        "2026-10-22",
        settings,
        database.db,
      ),
    ).resolves.toEqual({ status: "approved" });
    expect(await breakOf("eid-al-adha")).toMatchObject({
      ...days,
      adjusted: true,
    });
    await expect(
      updateHoliday(
        adha.id,
        days,
        change(),
        "2026-10-22",
        settings,
        database.db,
      ),
    ).resolves.toEqual({ status: "unchanged" });
    expect(
      await query(
        "select actor_id, diff from audit_events where action = 'holiday.approve'",
      ),
    ).toEqual([
      {
        actor_id: people.viceDean,
        diff: {
          to: { name: "إجازة عيد الأضحى", hijriYear: 1448, ...days },
        },
      },
    ]);
  });

  it("are changed under the college's lock, as every change to a calendar is (lead review C)", async () => {
    const adha = await breakOf("eid-al-adha");
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let locked = () => {};
    const lockTaken = new Promise<void>((resolve) => {
      locked = resolve;
    });
    // A term's change, still running in another transaction.
    const other = database.db.transaction(async (tx) => {
      await lockCollege(tx, collegeId);
      locked();
      await held;
    });
    await lockTaken;
    const update = updateHoliday(
      adha.id,
      { startsOn: adha.startsOn, endsOn: adha.endsOn },
      change(),
      "2026-10-22",
      settings,
      database.db,
    );
    await expect(
      Promise.race([
        update.then(() => "done"),
        new Promise((resolve) => setTimeout(() => resolve("waiting"), 300)),
      ]),
    ).resolves.toBe("waiting");
    release();
    await other;
    await expect(update).resolves.toEqual({ status: "unchanged" });
  });

  it("nor does a setting that counts a term's weeks change to a value that would leave its events outside it (lead review C)", async () => {
    // The finals in the last week of the terms of 1448, counted past both breaks while weeks that
    // holidays fill have no number: without that, a term ends four weeks sooner. The latest term
    // it strands is named.
    const left = await strandedBySetting(
      collegeId,
      "calendar.skipHolidayWeeks",
      false,
      database.db,
    );
    expect(left?.term).toMatch(/^الفصل الثاني 1448/);
    expect(left?.events.length).toBeGreaterThan(0);
    for (const [key, value] of [
      ["calendar.skipHolidayWeeks", true],
      ["platform.name", "Another name"],
    ] as const) {
      await expect(
        strandedBySetting(collegeId, key, value, database.db),
        key,
      ).resolves.toBeUndefined();
    }
  });
});

describe("the terms' list", () => {
  it("reads every term's calendar in the same statements however many terms the college has (lead review C)", async () => {
    const recorder = recording(database.pool);
    const listed = await listTermCalendars(collegeId, recorder.db);
    expect(listed.length).toBeGreaterThan(2);
    expect(await recorder.plans()).toHaveLength(4);
    for (const term of listed) {
      const found = await findTerm(collegeId, term.id, database.db);
      expect(term, term.name).toEqual(found);
    }
  });
});

describe("a term's exam periods (the owner's notes, 21 October 2026)", () => {
  const bareTerm = async (name: string) => {
    const created = await createTerm(
      { ...SECOND_TERM, name },
      change(),
      database.db,
    );
    if (created.status !== "created") throw new Error(created.status);
    return created.id;
  };
  const periodsOf = async (id: string) =>
    (await findTerm(collegeId, id, database.db))?.periods;

  it("are set by week number, each of the college's types once, and the log names each one that changed by its type", async () => {
    const id = await bareTerm("Term P");
    expect(await periodsOf(id)).toEqual([]);
    await expect(
      saveExamPeriods(id, [...PERIODS].reverse(), change(), database.db),
    ).resolves.toEqual({ status: "saved" });
    expect(await periodsOf(id)).toEqual(PERIODS);
    await expect(
      saveExamPeriods(id, PERIODS, change(), database.db),
    ).resolves.toEqual({ status: "unchanged" });
    // The second periodic a week later, and no practical final.
    const moved = [PERIODS[0], { ...PERIODS[1], from: 12, to: 13 }, PERIODS[3]];
    await expect(
      saveExamPeriods(id, moved, change(), database.db),
    ).resolves.toEqual({ status: "saved" });
    expect(await periodsOf(id)).toEqual(moved);
    expect(
      await query(
        `select actor_id, diff from audit_events
         where entity_id = $1 and action = 'examPeriods.update' order by created_at, id`,
        [id],
      ),
    ).toEqual([
      {
        actor_id: people.viceDean,
        diff: {
          from: {},
          to: {
            "الاختبارات الدورية الأولى": [5, 6],
            "الاختبارات الدورية الثانية": [11, 12],
            "الاختبارات النهائية العملية": [16],
            "الاختبارات النهائية النظرية": [17, 18],
          },
        },
      },
      {
        actor_id: people.viceDean,
        diff: {
          from: {
            "الاختبارات الدورية الثانية": [11, 12],
            "الاختبارات النهائية العملية": [16],
          },
          to: { "الاختبارات الدورية الثانية": [12, 13] },
        },
      },
    ]);
  });

  it("refuse a type the college does not have, and name a period past the term's last week or two that share a week", async () => {
    const id = await bareTerm("Term Q");
    const save = (periods: typeof PERIODS) =>
      saveExamPeriods(id, periods, change(), database.db);
    await expect(save([{ type: "midterm", from: 8, to: 8 }])).resolves.toEqual({
      status: "unknownType",
    });
    await expect(
      save([PERIODS[0], { ...PERIODS[3], to: 19 }]),
    ).resolves.toEqual({
      status: "pastEnd",
      periods: ["الاختبارات النهائية النظرية"],
    });
    await expect(
      save([PERIODS[2], { ...PERIODS[3], from: 16 }]),
    ).resolves.toEqual({
      status: "overlap",
      periods: ["الاختبارات النهائية العملية", "الاختبارات النهائية النظرية"],
    });
    expect(await periodsOf(id)).toEqual([]);
    await expect(
      saveExamPeriods(crypto.randomUUID(), PERIODS, change(), database.db),
    ).resolves.toEqual({ status: "notFound" });
    // Nor does another college's term take them.
    await expect(
      saveExamPeriods(
        id,
        PERIODS,
        { collegeId: otherCollegeId, actorId: people.viceDean },
        database.db,
      ),
    ).resolves.toEqual({ status: "notFound" });
  });

  it("stay in their weeks when the term is shortened, and keep it from becoming active until the vice-dean moves them", async () => {
    const id = await bareTerm("Term R");
    await saveExamPeriods(id, PERIODS, change(), database.db);
    await expect(
      updateTerm(
        id,
        { ...SECOND_TERM, name: "Term R", weeks: 17 },
        change(),
        settings,
        database.db,
      ),
    ).resolves.toEqual({ status: "saved" });
    expect(await periodsOf(id)).toEqual(PERIODS);
    await expect(activateTerm(id, change(), database.db)).resolves.toEqual({
      status: "periodProblems",
      periods: ["الاختبارات النهائية النظرية"],
    });
    // The theoretical final in the last week only.
    const fitted = [...PERIODS.slice(0, 3), { ...PERIODS[3], to: 17 }];
    await expect(
      saveExamPeriods(id, fitted, change(), database.db),
    ).resolves.toEqual({ status: "saved" });
    await expect(
      activateTerm(id, change(), database.db),
    ).resolves.toMatchObject({ status: "activated" });
    // A closed term's periods stay as they were.
    const [{ id: closed }] = await query(
      "select id from terms where college_id = $1 and status = 'closed' limit 1",
      [collegeId],
    );
    await expect(
      saveExamPeriods(closed, PERIODS, change(), database.db),
    ).resolves.toEqual({ status: "closed" });
  });
});
