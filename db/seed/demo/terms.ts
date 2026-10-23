import { and, eq } from "drizzle-orm";
import {
  addMembership,
  listDirectory,
  roles,
} from "../../../src/modules/access/index.ts";
import { users } from "../../../src/modules/identity/index.ts";
import { listDepartments } from "../../../src/modules/org/index.ts";
import { getSetting, weekdays } from "../../../src/modules/settings/index.ts";
import {
  activateTerm,
  activeTerm,
  addCalendarEvent,
  type CalendarEventInput,
  calendarOf,
  calendarSettings,
  createTerm,
  holidaysFrom,
  saveExamPeriods,
  termEndsOn,
  terms,
  termWeeks,
  umAlQuraYear,
  updateHoliday,
} from "../../../src/modules/terms/index.ts";
import type { Db } from "../../../src/platform/db/client.ts";
import { addDays, wallClock } from "../../../src/platform/i18n/time-zone.ts";
import { demoAccounts } from "./accounts.ts";
import { demoDepartments } from "./departments.ts";
import { deviceOf } from "./device.ts";

// The demo college's active term (Step 13): 18 weeks from the first day of a week, so that today
// falls in week N (seed:demo --week, 9 by default), counted past the college's holidays that fall
// in it. Its calendar holds a meeting to open the term, an extra holiday as the technical colleges'
// calendars give, National Day where it falls in the term, and the grades due on the last working
// day. The vice-dean enters it all, in the log. One trainer of Electrical is the department's
// secretary for this term only, the role a term-limited membership gives. Written once, while the
// college has no term.

export const DEMO_TERM_WEEKS = 18;

// Days of the year the kingdom keeps, by month and day, as the term's own holidays. Founding Day is
// the college's (ADR-0018).
const NATIONAL_DAYS = [{ title: "اليوم الوطني", month: 9, day: 23 }];

// The term's name as Rayat writes it: first, second or summer, by the month it starts in.
function termName(startsOn: string) {
  const month = Number(startsOn.slice(5, 7));
  const which =
    month >= 8 && month <= 11
      ? "الأول"
      : month >= 5 && month <= 7
        ? "الصيفي"
        : "الثاني";
  return `الفصل التدريبي ${which} ${umAlQuraYear(startsOn)}`;
}

export async function seedDemoTerms(
  { db }: { db: Db },
  collegeId: string,
  week: number,
) {
  const [made] = await db
    .select({ id: terms.id })
    .from(terms)
    .where(eq(terms.collegeId, collegeId))
    .limit(1);
  if (made) return;

  const [timeZone, weekStart, settings, [viceDean]] = await Promise.all([
    getSetting("locale.timeZone", { collegeId }, db),
    getSetting("locale.weekStart", { collegeId }, db),
    calendarSettings(collegeId, db),
    db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, demoAccounts.viceDean.email)),
  ]);
  if (!viceDean) throw new Error("seed:demo: the vice-dean is missing");
  const change = {
    collegeId,
    actorId: viceDean.id,
    ...(await deviceOf(db, collegeId, viceDean.id)),
  };
  const today = wallClock(new Date(), timeZone).slice(0, 10);
  const thisWeek = addDays(
    today,
    -(
      (new Date(`${today}T00:00:00Z`).getUTCDay() -
        weekdays.indexOf(weekStart) +
        7) %
      7
    ),
  );

  // N - 1 weeks back, then a week further back for each week of an Eid break in between, until
  // N - 1 numbered weeks come before this one.
  const breaks = await holidaysFrom(collegeId, addDays(thisWeek, -7 * 60), db);
  let startsOn = addDays(thisWeek, -7 * (week - 1));
  for (let tries = 0; tries < 10; tries++) {
    const before = termWeeks(
      calendarOf({ startsOn, weeks: DEMO_TERM_WEEKS }, [], settings, breaks),
    ).filter((each) => each.startsOn < thisWeek && each.number !== null).length;
    if (before === week - 1) break;
    startsOn = addDays(startsOn, -7 * (week - 1 - before));
  }

  const created = await createTerm(
    { name: termName(startsOn), startsOn, weeks: DEMO_TERM_WEEKS },
    change,
    db,
  );
  if (created.status !== "created") {
    throw new Error(`seed:demo: the term was not made (${created.status})`);
  }

  const calendar = calendarOf(
    { startsOn, weeks: DEMO_TERM_WEEKS },
    [],
    settings,
    breaks,
  );
  const lastDay = termEndsOn(calendar);
  const first = (number: number) =>
    termWeeks(calendar).find((each) => each.number === number)?.startsOn ??
    startsOn;
  // The week's last working day, as many days on from its first as the college works.
  const lastWorking = (day: string) =>
    addDays(day, settings.workingDays.size - 1);
  const events: CalendarEventInput[] = [
    {
      kind: "custom",
      title: "لقاء بداية الفصل للمدربين",
      startsOn: first(1),
      endsOn: first(1),
    },
    {
      kind: "holiday",
      title: "إجازة إضافية",
      startsOn: first(11),
      endsOn: first(11),
    },
    {
      kind: "gradeDeadline",
      title: "آخر موعد لرصد الدرجات",
      startsOn: lastWorking(first(18)),
      endsOn: lastWorking(first(18)),
    },
  ];
  for (const year of new Set([startsOn.slice(0, 4), lastDay.slice(0, 4)])) {
    for (const { title, month, day } of NATIONAL_DAYS) {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (startsOn <= date && date <= lastDay) {
        events.push({ kind: "holiday", title, startsOn: date, endsOn: date });
      }
    }
  }
  for (const event of events) {
    const added = await addCalendarEvent(
      created.id,
      event,
      change,
      settings,
      db,
    );
    if (added.status !== "saved") {
      throw new Error(
        `seed:demo: ${event.title} was not added (${added.status})`,
      );
    }
  }
  await activateTerm(created.id, change, db);

  // The vice-dean has approved the coming holiday as it was estimated; the others wait for their
  // announcement (ADR-0018).
  const coming = (await holidaysFrom(collegeId, today, db)).find(
    (each) => each.startsOn > today,
  );
  if (coming) {
    const approved = await updateHoliday(
      coming.id,
      { startsOn: coming.startsOn, endsOn: coming.endsOn },
      change,
      today,
      settings,
      db,
    );
    if (approved.status !== "approved") {
      throw new Error(
        `seed:demo: ${coming.name} was not approved (${approved.status})`,
      );
    }
  }

  // Electrical's secretary for this term only: its first trainer by employee number who is not one
  // the tests sign in as, nor its secretary for every term already (Audit 5).
  const [electrical] = (await listDepartments(collegeId, db)).filter(
    ({ name }) => name === demoDepartments[1].name,
  );
  const [secretary, trainer] = await Promise.all(
    ["secretary", "trainer"].map(async (key) => {
      const [role] = await db
        .select({ id: roles.id })
        .from(roles)
        .where(and(eq(roles.collegeId, collegeId), eq(roles.key, key)));
      return role;
    }),
  );
  if (!electrical || !secretary || !trainer) return;
  const tested = new Set(Object.values(demoAccounts).map(({ email }) => email));
  const [person] = (
    await listDirectory(collegeId, { departments: [electrical.id] }, db)
  )
    .filter(
      (entry) =>
        !tested.has(entry.email) &&
        entry.memberships.some(
          ({ roleId, departmentId }) =>
            roleId === trainer.id && departmentId === electrical.id,
        ) &&
        !entry.memberships.some(
          ({ roleId, departmentId }) =>
            roleId === secretary.id && departmentId === electrical.id,
        ),
    )
    .sort((a, b) => a.employeeNumber.localeCompare(b.employeeNumber));
  if (!person) return;
  const admin = (await listDirectory(collegeId, {}, db)).find(
    ({ email }) => email === demoAccounts.admin.email,
  );
  const giver = admin?.userId ?? viceDean.id;
  await addMembership(
    {
      userId: person.userId,
      roleId: secretary.id,
      departmentId: electrical.id,
      termId: created.id,
    },
    { collegeId, actorId: giver, ...(await deviceOf(db, collegeId, giver)) },
    db,
  );
}

// The demo term's exam periods as the owner's canvas sets them (21 October 2026): the first
// periodic exams in weeks 5 and 6, the second in weeks 11 and 12, the practical final in week 16 and
// the theoretical final in weeks 17 and 18, by the base seed's types. The vice-dean sets them, in
// the log. Written once, while the active term has none, a demo term made before them included.
export const DEMO_EXAM_PERIODS = [
  { type: "first-periodic", from: 5, to: 6 },
  { type: "second-periodic", from: 11, to: 12 },
  { type: "practical-final", from: 16, to: 16 },
  { type: "theoretical-final", from: 17, to: 18 },
];

export async function seedDemoExamPeriods(
  { db }: { db: Db },
  collegeId: string,
) {
  const term = await activeTerm(collegeId, db);
  if (!term || term.periods.length > 0) return;
  const [viceDean] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, demoAccounts.viceDean.email));
  if (!viceDean) throw new Error("seed:demo: the vice-dean is missing");
  const saved = await saveExamPeriods(
    term.id,
    DEMO_EXAM_PERIODS,
    {
      collegeId,
      actorId: viceDean.id,
      ...(await deviceOf(db, collegeId, viceDean.id)),
    },
    db,
  );
  if (saved.status !== "saved") {
    throw new Error(
      `seed:demo: the exam periods were not saved (${saved.status})`,
    );
  }
}
