import { eq, inArray } from "drizzle-orm";
import { holdersIn } from "../../../src/modules/access/index.ts";
import { listAxes } from "../../../src/modules/axes/index.ts";
import { people, users } from "../../../src/modules/identity/index.ts";
import { listDepartments } from "../../../src/modules/org/index.ts";
import {
  quickRequests,
  sendQuickRequest,
} from "../../../src/modules/requests/index.ts";
import { getSetting } from "../../../src/modules/settings/index.ts";
import { queueGeneration, runNow } from "../../../src/modules/tasks/index.ts";
import {
  activeTerm,
  calendarOf,
  calendarSettings,
  dueDay,
  termWeeks,
  weekReached,
} from "../../../src/modules/terms/index.ts";
import type { Db } from "../../../src/platform/db/client.ts";
import { wallClock } from "../../../src/platform/i18n/time-zone.ts";
import { demoAccounts } from "./accounts.ts";
import { demoDepartments } from "./departments.ts";
import { deviceOf } from "./device.ts";
import { demoTrainers } from "./people.ts";

// The demo term's quick requests (Step 22), each sent as the requests page sends it, by the same
// functions: kept with its pass queued, and that pass run at once, which makes its tasks and tells
// each person it reached (lead review D, M2). The head of Electrical
// asked four of the department's trainers for their attendance sheets by the end of next week; the
// vice-dean asked everyone in Mechanical for the practical exams' timetable a week later; and the
// dean asked the three heads for their proposals for next year's operating plan, as a document. The
// demo trainer is in none, so their bell stays read (Audit 4). Written once, after the term's first
// pass, while the term has no request; a request whose day the term no longer reaches is left out.
export async function seedDemoRequests({ db }: { db: Db }, collegeId: string) {
  const term = await activeTerm(collegeId, db);
  if (!term) return;
  const [sent] = await db
    .select({ id: quickRequests.id })
    .from(quickRequests)
    .where(eq(quickRequests.termId, term.id))
    .limit(1);
  if (sent) return;

  const [settings, timeZone, departments, groups] = await Promise.all([
    calendarSettings(collegeId, db),
    getSetting("locale.timeZone", { collegeId }, db),
    listDepartments(collegeId, db),
    listAxes(collegeId, db),
  ]);
  const calendar = calendarOf(term, term.events, settings, term.breaks);
  const weeks = termWeeks(calendar).filter((week) => week.number !== null);
  const today = wallClock(new Date(), timeZone).slice(0, 10);
  const reached = weekReached(weeks, today);
  // The due day of the week so many weeks on, or of the term's last.
  const dueIn = (ahead: number) => {
    const week =
      weeks.find((each) => each.number === reached + ahead) ?? weeks.at(-1);
    return week ? dueDay(calendar, week) : today;
  };
  const axis = (code: string) => {
    const found = groups
      .flatMap((group) => group.axes)
      .find((each) => each.code === code);
    if (!found) throw new Error(`seed:demo: no axis ${code}`);
    return found.id;
  };
  const departmentOf = (name: string) => {
    const found = departments.find((each) => each.name === name);
    if (!found) throw new Error(`seed:demo: no department ${name}`);
    return found.id;
  };
  const [electrical, mechanical] = [
    departmentOf(demoDepartments[1].name),
    departmentOf(demoDepartments[2].name),
  ];
  const userByEmail = async (email: string) => {
    const [user] = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.email, email));
    if (!user) throw new Error(`seed:demo: ${email} is missing`);
    return user;
  };
  const [head, viceDean, dean] = await Promise.all([
    userByEmail(demoAccounts.head.email),
    userByEmail(demoAccounts.viceDean.email),
    userByEmail(demoAccounts.dean.email),
  ]);
  const four = await db
    .select({ userId: people.userId })
    .from(people)
    .where(inArray(people.employeeNumber, demoTrainers[1].slice(1, 5)));
  const heads = [
    ...(
      await holdersIn(
        collegeId,
        departments.map(({ id }) => id),
        "plan.publish",
        db,
      )
    ).entries(),
  ].flatMap(([departmentId, holders]) =>
    holders.slice(0, 1).map(({ userId }) => ({ userId, departmentId })),
  );

  const requests = [
    {
      sender: head,
      input: {
        departmentId: electrical,
        title: "رفع كشوف حضور الأسبوع للشعب العملية",
        axisId: axis("6"),
        dueOn: dueIn(1),
        targets: {
          type: "people" as const,
          people: four.map(({ userId }) => ({
            userId,
            departmentId: electrical,
          })),
        },
        evidence: true,
      },
    },
    {
      sender: viceDean,
      input: {
        departmentId: mechanical,
        title: "اعتماد جدول الاختبارات العملية للمقررات",
        axisId: axis("2"),
        dueOn: dueIn(2),
        targets: { type: "everyone" as const },
        evidence: true,
      },
    },
    {
      sender: dean,
      input: {
        departmentId: null,
        title: "مقترحات القسم للخطة التشغيلية للعام القادم",
        axisId: axis("10"),
        dueOn: dueIn(3),
        targets: { type: "people" as const, people: heads },
        evidence: true,
      },
    },
  ];
  for (const { sender, input } of requests) {
    if (input.dueOn < today) continue;
    const change = {
      collegeId,
      actorId: sender.id,
      ...(await deviceOf(db, collegeId, sender.id)),
    };
    const made = await sendQuickRequest(
      { ...input, termId: term.id },
      change,
      (tx) => queueGeneration(collegeId, term.id, "request", tx),
      new Date(),
      db,
    );
    if (made.status !== "sent") {
      throw new Error(
        `seed:demo: «${input.title}» was not sent (${made.status})`,
      );
    }
    if ((await runNow(made.runId, { db })) !== "done") {
      throw new Error(`seed:demo: «${input.title}»'s pass did not run`);
    }
  }
}
