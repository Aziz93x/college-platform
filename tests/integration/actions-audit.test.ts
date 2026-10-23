import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { seedBase, systemRole } from "../../db/seed/base.ts";
import { rayatColumns, rayatHeaders } from "../../db/seed/rayat-columns.ts";
import { joinRole } from "../../src/modules/access/index.ts";
import { createAccount } from "../../src/modules/identity/index.ts";
import { notify } from "../../src/modules/notifications/index.ts";
import { uploadRayat } from "../../src/modules/rayat/index.ts";
import { getDb } from "../../src/platform/db/client.ts";
import { csvLines } from "../../src/platform/files/table.ts";
import { base32Bytes, totp } from "../support/totp.ts";
import { createSharedTestDatabase } from "./support/database.ts";

// Every server action, run as a person would on a real database, with the events it leaves in the
// log (docs/PLAN.md, Step 11): the sign-in pages' actions in the order a first sign-in takes them,
// then each change to the college's records. Signing in and its code step are judged by outcome: a
// wrong password or code writes nothing until it locks the account or its codes (Step 6, Audit 2).

// A browser: the cookies Better Auth sets through next/headers, sent back with each request from
// one address.
const browser = vi.hoisted(() => ({ cookies: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      cookie: [...browser.cookies]
        .map(([name, value]) => `${name}=${value}`)
        .join("; "),
      "x-forwarded-for": "10.0.30.7",
      "user-agent": "integration-test",
    }),
  cookies: async () => ({
    set: (name: string, value: string, options?: { maxAge?: number }) => {
      if (value === "" || options?.maxAge === 0) browser.cookies.delete(name);
      else browser.cookies.set(name, value);
    },
  }),
}));
vi.mock("next/cache", () => ({ refresh: () => {} }));
// Where an action sends the person next; Next.js would answer with that page.
vi.mock("next/navigation", () => ({ redirect: () => {} }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));

type Result =
  | { data?: unknown; serverError?: unknown; validationErrors?: unknown }
  | undefined;
type Action = (...args: unknown[]) => Promise<Result>;

const modules = Object.fromEntries(
  Object.entries(
    import.meta.glob<Record<string, Action>>("../../src/app/**/actions.ts", {
      eager: true,
    }),
  ).map(([path, module]) => [path.replace("../../src/app/", ""), module]),
);

// What each action writes when it does its work. A new action fails "every action is here" until
// it has a line, and its test.
const writes: Record<string, string[]> = {
  "(auth)/actions.ts#signInAction": ["session.signIn"],
  "(auth)/actions.ts#verifyCodeAction": ["session.signIn"],
  "(auth)/actions.ts#startTwoFactorSetupAction": [
    "account.startTwoFactorSetup",
  ],
  "(auth)/actions.ts#confirmTwoFactorSetupAction": ["account.enableTwoFactor"],
  "(auth)/actions.ts#changePasswordAction": ["account.changePassword"],
  "(auth)/actions.ts#signOutAction": ["session.signOut"],
  "(app)/departments/actions.ts#createDepartmentAction": ["department.create"],
  "(app)/departments/actions.ts#updateDepartmentAction": ["department.update"],
  "(app)/departments/actions.ts#updateCollegeAction": ["college.update"],
  "(app)/settings/actions.ts#saveSettingAction": ["setting.update"],
  "(app)/settings/actions.ts#resetSettingAction": ["setting.reset"],
  "(app)/roles/actions.ts#createRoleAction": ["role.create"],
  "(app)/roles/actions.ts#renameRoleAction": ["role.update"],
  "(app)/roles/actions.ts#setRolePermissionsAction": ["role.update"],
  "(app)/roles/actions.ts#addMembershipAction": ["membership.create"],
  "(app)/roles/actions.ts#removeMembershipAction": ["membership.delete"],
  "(app)/roles/actions.ts#savePageOrderAction": ["setting.update"],
  // The import's dry run: it reads the file and the college, and changes nothing.
  "(app)/people/actions.ts#previewPeopleAction": [],
  "(app)/people/actions.ts#importPeopleAction": [
    "account.create",
    "membership.create",
  ],
  "(app)/people/actions.ts#updatePersonAction": ["person.update"],
  "(app)/people/actions.ts#disableAccountAction": ["account.disable"],
  "(app)/people/actions.ts#resetPasswordAction": ["account.resetPassword"],
  "(app)/people/actions.ts#turnOffTwoFactorAction": [
    "account.disableTwoFactor",
  ],
  "(app)/people/actions.ts#linkEmployeeNumberAction": [
    "person.linkEmployeeNumber",
  ],
  "(app)/notifications/actions.ts#markReadAction": ["notification.read"],
  "(app)/notifications/actions.ts#chooseNotificationAction": [
    "notification.mute",
  ],
  "(app)/profile/actions.ts#turnOffOwnTwoFactorAction": [
    "account.disableTwoFactor",
  ],
  "(app)/announcements/actions.ts#publishAnnouncementAction": [
    "announcement.publish",
  ],
  "(app)/announcements/actions.ts#withdrawAnnouncementAction": [
    "announcement.withdraw",
  ],
  "(app)/terms/actions.ts#createTermAction": ["term.create"],
  "(app)/terms/actions.ts#updateTermAction": ["term.update"],
  "(app)/terms/actions.ts#addCalendarEventAction": ["calendarEvent.create"],
  "(app)/terms/actions.ts#updateCalendarEventAction": ["calendarEvent.update"],
  "(app)/terms/actions.ts#removeCalendarEventAction": ["calendarEvent.delete"],
  "(app)/terms/actions.ts#saveExamPeriodsAction": ["examPeriods.update"],
  // The next term, a draft with what it took from the term's calendar.
  // The wizard copies the term's framework into the new term as a draft (Step 15), and each
  // department's plan (Step 19).
  "(app)/terms/actions.ts#openNextTermAction": [
    "term.create",
    "framework.create",
    "plan.create",
  ],
  "(app)/terms/actions.ts#activateTermAction": ["term.activate"],
  "(app)/terms/actions.ts#closeTermAction": ["term.close"],
  "(app)/terms/actions.ts#updateHolidayAction": ["holiday.update"],
  "(app)/axes/actions.ts#updateAxisAction": ["axis.update"],
  "(app)/framework/actions.ts#startDraftAction": ["framework.create"],
  "(app)/framework/actions.ts#addItemAction": ["frameworkItem.create"],
  "(app)/framework/actions.ts#updateItemAction": ["frameworkItem.update"],
  "(app)/framework/actions.ts#removeItemAction": ["frameworkItem.delete"],
  "(app)/framework/actions.ts#endorseDraftAction": ["framework.endorse"],
  "(app)/framework/actions.ts#publishDraftAction": ["framework.publish"],
  "(app)/rayat/actions.ts#uploadRayatAction": ["rayatImport.upload"],
  "(app)/rayat/actions.ts#applyRayatAction": ["rayatImport.apply"],
  "(app)/rayat/actions.ts#discardRayatAction": ["rayatImport.discard"],
  "(app)/rayat/actions.ts#rollbackRayatAction": ["rayatImport.rollback"],
  "(app)/sections/actions.ts#transferSectionAction": ["sectionTransfer.create"],
  "(app)/sections/actions.ts#keepTransferAction": ["sectionTransfer.keep"],
  "(app)/sections/actions.ts#cancelTransferAction": ["sectionTransfer.cancel"],
  "(app)/plan/actions.ts#startPlanAction": ["plan.create"],
  "(app)/plan/actions.ts#addPlanItemAction": ["planItem.create"],
  "(app)/plan/actions.ts#updatePlanItemAction": ["planItem.update"],
  "(app)/plan/actions.ts#movePlanItemsAction": ["planItem.update"],
  "(app)/plan/actions.ts#removePlanItemsAction": ["planItem.delete"],
  "(app)/plan/actions.ts#publishPlanAction": ["plan.publish"],
  "(app)/assignments/actions.ts#createTemplateAction": [
    "assignmentTemplate.create",
  ],
  "(app)/assignments/actions.ts#updateTemplateAction": [
    "assignmentTemplate.update",
  ],
  "(app)/assignments/actions.ts#deleteTemplateAction": [
    "assignmentTemplate.delete",
  ],
  "(app)/assignments/actions.ts#addTemplateItemAction": [
    "assignmentTemplateItem.create",
  ],
  "(app)/assignments/actions.ts#updateTemplateItemAction": [
    "assignmentTemplateItem.update",
  ],
  "(app)/assignments/actions.ts#removeTemplateItemAction": [
    "assignmentTemplateItem.delete",
  ],
  // The secretary's template, which grants its role with the assignment and takes it back with it.
  "(app)/assignments/actions.ts#assignAction": [
    "assignment.create",
    "membership.create",
  ],
  "(app)/assignments/actions.ts#revokeAssignmentAction": [
    "membership.delete",
    "assignment.revoke",
  ],
};

const PASSWORD = "correct-horse-battery";
const NEW_PASSWORD = "staple-horse-battery";

let database: Awaited<ReturnType<typeof createSharedTestDatabase>>;
let collegeId: string;
let lastNumber = 5000;
const ran = new Set<string>();

const query = async (text: string, values: unknown[] = []) =>
  (await database.pool.query(text, values)).rows;

async function person(name: string, password = PASSWORD) {
  const employeeNumber = String(++lastNumber);
  const email = `p${employeeNumber}@college.example`;
  const { userId } = await getDb().transaction((tx) =>
    createAccount({ collegeId, name, email, employeeNumber }, tx, password),
  );
  return { userId, email, employeeNumber };
}

// Runs an action and returns what it answered and the events the log gained, as action and actor.
// A server action's form state comes first; the others take their input alone.
async function run(name: string, ...args: unknown[]) {
  const [module, exported] = name.split("#");
  const [{ count }] = await query("select count(*)::int from audit_events");
  const result = await modules[module][exported](...args);
  ran.add(name);
  expect(result?.serverError, name).toBeUndefined();
  expect(result?.validationErrors, name).toBeUndefined();
  const events = await query(
    "select action, actor_id from audit_events order by created_at, id offset $1",
    [count],
  );
  return {
    data: result?.data as Record<string, unknown>,
    written: events.map((event) => event.action as string),
    actors: events.map((event) => event.actor_id as string | null),
  };
}

let admin: Awaited<ReturnType<typeof person>>;
let trainer: Awaited<ReturnType<typeof person>>;
let secret: Buffer;
const code = (offset = 0) => totp(secret, Date.now() + offset * 30_000);

beforeAll(async () => {
  database = await createSharedTestDatabase();
  collegeId = await seedBase(database.db, {
    name: "Test College",
    shortName: "TC",
  });
  admin = await person("The Admin");
  await joinRole({ userId: admin.userId, collegeId, role: systemRole });
  trainer = await person("A Trainer");
  await joinRole({
    userId: trainer.userId,
    collegeId,
    role: { key: "trainer" },
  });
  // Three wrong passwords lock an account, the fewest the setting allows.
  await query(
    "insert into settings (college_id, key, value) values ($1, 'auth.lockoutThreshold', '3')",
    [collegeId],
  );
});

afterAll(() => database?.drop());

describe("every server action writes its event", () => {
  it("signing in: a wrong password writes nothing until it locks the account, a right one session.signIn", async () => {
    const signIn = "(auth)/actions.ts#signInAction";
    const locked = await person("Locked Out");
    const wrong = { identifier: locked.email, password: "not-the-password" };
    expect((await run(signIn, {}, wrong)).written).toEqual([]);
    expect((await run(signIn, {}, wrong)).written).toEqual([]);
    const third = await run(signIn, {}, wrong);
    expect(third.data).toMatchObject({ status: "locked" });
    expect(third.written).toEqual(["account.lock"]);

    const signedIn = await run(
      signIn,
      {},
      {
        identifier: admin.email,
        password: PASSWORD,
      },
    );
    expect(signedIn.data).toEqual({ status: "signedIn" });
    expect(signedIn.written).toEqual(writes[signIn]);
    expect(signedIn.actors).toEqual([admin.userId]);
  });

  it("setting up two-factor writes its start and its confirmation", async () => {
    const start = "(auth)/actions.ts#startTwoFactorSetupAction";
    const started = await run(start, {}, { password: PASSWORD });
    expect(started.data).toMatchObject({ status: "started" });
    expect(started.written).toEqual(writes[start]);
    secret = base32Bytes(started.data.secret as string);

    const confirm = "(auth)/actions.ts#confirmTwoFactorSetupAction";
    const confirmed = await run(confirm, {}, { code: code() });
    expect(confirmed.data).toEqual({ status: "enabled" });
    expect(confirmed.written).toEqual(writes[confirm]);
  });

  it("changing the password, then signing out, write theirs", async () => {
    const change = "(auth)/actions.ts#changePasswordAction";
    const changed = await run(
      change,
      {},
      {
        currentPassword: PASSWORD,
        newPassword: NEW_PASSWORD,
        confirmPassword: NEW_PASSWORD,
      },
    );
    expect(changed.data).toMatchObject({ status: "changed" });
    expect(changed.written).toEqual(writes[change]);

    const signOut = "(auth)/actions.ts#signOutAction";
    const signedOut = await run(signOut);
    expect(signedOut.written).toEqual(writes[signOut]);
    expect(signedOut.actors).toEqual([admin.userId]);
  });

  it("the code step: the password alone writes nothing, a wrong code nothing, the right one session.signIn", async () => {
    const signIn = "(auth)/actions.ts#signInAction";
    const asked = await run(
      signIn,
      {},
      {
        identifier: admin.email,
        password: NEW_PASSWORD,
      },
    );
    expect(asked.data).toEqual({ status: "twoFactor" });
    expect(asked.written).toEqual([]);

    const verify = "(auth)/actions.ts#verifyCodeAction";
    expect((await run(verify, {}, { code: "000000" })).written).toEqual([]);
    const verified = await run(verify, {}, { code: code(1) });
    expect(verified.data).toEqual({ status: "signedIn" });
    expect(verified.written).toEqual(writes[verify]);
    expect(verified.actors).toEqual([admin.userId]);
  });

  it("each change to the college's records writes its own event, by the admin who made it", async () => {
    const expectWrites = async (name: string, ...args: unknown[]) => {
      const outcome = await run(name, ...args);
      expect(outcome.written, name).toEqual(writes[name]);
      expect(new Set(outcome.actors), name).toEqual(
        new Set(writes[name].length > 0 ? [admin.userId] : []),
      );
      return outcome.data;
    };

    const department = {
      name: "Electrical",
      shortName: "Elec",
      rayatValues: ["Electrical"],
      active: true,
    };
    const created = await expectWrites(
      "(app)/departments/actions.ts#createDepartmentAction",
      department,
    );
    await expectWrites("(app)/departments/actions.ts#updateDepartmentAction", {
      ...department,
      id: created.id,
      name: "Electrical Technology",
    });
    await expectWrites("(app)/departments/actions.ts#updateCollegeAction", {
      name: "Oasis College",
      shortName: "Oasis",
    });

    await expectWrites("(app)/settings/actions.ts#saveSettingAction", {
      key: "reminders.digestHour",
      value: 8,
    });
    await expectWrites("(app)/settings/actions.ts#resetSettingAction", {
      key: "reminders.digestHour",
    });

    const role = await expectWrites("(app)/roles/actions.ts#createRoleAction", {
      label: "Coordinator",
    });
    await expectWrites("(app)/roles/actions.ts#renameRoleAction", {
      id: role.id,
      label: "Coordinators",
    });
    await expectWrites("(app)/roles/actions.ts#setRolePermissionsAction", {
      id: role.id,
      permissions: ["task.complete"],
    });
    const membership = await expectWrites(
      "(app)/roles/actions.ts#addMembershipAction",
      { userId: trainer.userId, roleId: role.id, departmentId: created.id },
    );
    await expectWrites("(app)/roles/actions.ts#removeMembershipAction", {
      id: membership.id,
    });
    await expectWrites("(app)/roles/actions.ts#savePageOrderAction", {
      roleId: role.id,
      order: ["today"],
    });

    const row = {
      employeeNumber: "6001",
      name: "A New Trainer",
      email: "p6001@college.example",
      department: "Electrical",
      role: "المدرب",
    };
    const file = new File(
      [
        `employeeNumber,name,email,department,role\n${Object.values(row).join(",")}\n`,
      ],
      "people.csv",
    );
    const preview = await expectWrites(
      "(app)/people/actions.ts#previewPeopleAction",
      { file },
    );
    expect(preview.status).toBe("planned");
    await expectWrites("(app)/people/actions.ts#importPeopleAction", {
      rows: [{ line: 2, ...row }],
    });

    await expectWrites("(app)/people/actions.ts#updatePersonAction", {
      userId: trainer.userId,
      name: "A Trainer Renamed",
      email: trainer.email,
    });
    await expectWrites("(app)/people/actions.ts#disableAccountAction", {
      userId: trainer.userId,
      disabled: true,
    });
    const enabled = await run("(app)/people/actions.ts#disableAccountAction", {
      userId: trainer.userId,
      disabled: false,
    });
    expect(enabled.written).toEqual(["account.enable"]);
    await expectWrites("(app)/people/actions.ts#resetPasswordAction", {
      userId: trainer.userId,
    });
    await expectWrites("(app)/people/actions.ts#linkEmployeeNumberAction", {
      userId: trainer.userId,
      employeeNumber: "6002",
    });
    // The trainer's two-factor, on as if they had set it up, turned off for them.
    await query("update users set two_factor_enabled = true where id = $1", [
      trainer.userId,
    ]);
    await expectWrites("(app)/people/actions.ts#turnOffTwoFactorAction", {
      userId: trainer.userId,
    });

    // The admin's own notifications: one to read, then the digest turned off and on again.
    await notify({
      collegeId,
      userId: admin.userId,
      kind: "membershipAdded",
      params: { role: "Coordinators", scope: "college" },
    });
    await expectWrites("(app)/notifications/actions.ts#markReadAction", {});
    await expectWrites(
      "(app)/notifications/actions.ts#chooseNotificationAction",
      { kind: "weeklyDigest", enabled: false },
    );
    const unmuted = await run(
      "(app)/notifications/actions.ts#chooseNotificationAction",
      { kind: "weeklyDigest", enabled: true },
    );
    expect(unmuted.written).toEqual(["notification.unmute"]);

    // An announcement to the college, then taken back (ADR-0017).
    const published = await expectWrites(
      "(app)/announcements/actions.ts#publishAnnouncementAction",
      { departmentId: null, title: "A holiday", body: "On Sunday." },
    );
    await expectWrites(
      "(app)/announcements/actions.ts#withdrawAnnouncementAction",
      { id: published.id },
    );

    // A term and its calendar, the next term opened from it once its framework is published, and
    // the term made active, then closed (Step 13).
    const terms = "(app)/terms/actions.ts";
    const spring = { name: "Spring 1447", startsOn: "2026-01-04", weeks: 18 };
    const term = await expectWrites(`${terms}#createTermAction`, spring);
    await expectWrites(`${terms}#updateTermAction`, {
      id: term.id,
      ...spring,
      weeks: 17,
    });
    const openDay = {
      kind: "custom",
      title: "Open day",
      startsOn: "2026-03-01",
      endsOn: "2026-03-05",
    };
    await expectWrites(`${terms}#addCalendarEventAction`, {
      termId: term.id,
      ...openDay,
    });
    const [{ id: eventId }] = await query(
      "select id from calendar_events where term_id = $1",
      [term.id],
    );
    await expectWrites(`${terms}#updateCalendarEventAction`, {
      termId: term.id,
      eventId,
      ...openDay,
      title: "Open days",
    });
    await expectWrites(`${terms}#removeCalendarEventAction`, {
      termId: term.id,
      eventId,
    });
    await expectWrites(`${terms}#saveExamPeriodsAction`, {
      termId: term.id,
      periods: [{ type: "first-periodic", from: 5, to: 6 }],
    });

    // The term's SF01: uploaded and applied, a newer one uploaded and discarded, and the version
    // rolled back (Step 16).
    const rayat = "(app)/rayat/actions.ts";
    const sf01 = (registrationStatus: string) => {
      const values: Record<string, string> = {
        term: spring.name,
        department: "Electrical",
        courseCode: "ELC 101",
        sectionRef: "30101",
        traineeNumber: "441100001",
        registrationStatus,
        traineeStatus: "Active",
      };
      const columns = Object.entries(rayatColumns.sf01);
      const row = rayatHeaders.sf01.map(
        (header) =>
          values[columns.find(([, name]) => name === header)?.[0] ?? ""] ?? "",
      );
      return {
        termId: term.id,
        kind: "sf01",
        file: new File([csvLines([rayatHeaders.sf01, row])], "sf01.csv"),
      };
    };
    const first = await expectWrites(
      `${rayat}#uploadRayatAction`,
      sf01("Registered"),
    );
    expect(first.status).toBe("pending");
    await expectWrites(`${rayat}#applyRayatAction`, {
      importId: first.importId,
    });
    const newer = await expectWrites(
      `${rayat}#uploadRayatAction`,
      sf01("Withdrawn"),
    );
    await expectWrites(`${rayat}#discardRayatAction`, {
      importId: newer.importId,
    });
    await expectWrites(`${rayat}#rollbackRayatAction`, {
      importId: first.importId,
    });
    // The passes of the generation engine the actions have queued, by what queued them: the exam
    // periods saved, which rules anchored to them move with, and none for SF01's trainees, who
    // change no task (Step 20).
    const queued = async () =>
      (
        await query(
          "select reason from generation_runs where term_id = $1 order by queued_at, id",
          [term.id],
        )
      ).map((run) => run.reason);
    expect(await queued()).toEqual(["periods"]);

    // The term's SS01, applied: its section transferred to a trainer of Electrical, the transfer
    // kept against a newer SS01 in conflict with it, then cancelled (Step 17, lead review C).
    const sections = "(app)/sections/actions.ts";
    const teacher = await person("An Electrical Trainer");
    await joinRole({
      userId: teacher.userId,
      collegeId,
      role: { key: "trainer" },
      departmentId: created.id as string,
    });
    const meeting: Record<string, string> = {
      term: spring.name,
      department: "Electrical",
      courseCode: "ELC 101",
      courseName: "Circuits",
      creditHours: "3",
      sectionRef: "30101",
      deliveryMode: "Classroom",
      day: "Sunday",
      time: "08:00 - 09:40",
      building: "B1",
      room: "101",
      capacity: "30",
      enrolled: "28",
      remaining: "2",
      trainerNumber: trainer.employeeNumber,
    };
    const ss01Columns = Object.entries(rayatColumns.ss01);
    const applySs01 = async (room: string) => {
      const uploaded = await uploadRayat(
        "ss01",
        term.id as string,
        [
          rayatHeaders.ss01,
          rayatHeaders.ss01.map(
            (header) =>
              ({ ...meeting, room })[
                ss01Columns.find(([, name]) => name === header)?.[0] ?? ""
              ] ?? "",
          ),
        ],
        { collegeId, actorId: admin.userId },
      );
      if (uploaded.status !== "pending") throw new Error(uploaded.status);
      await expectWrites(`${rayat}#applyRayatAction`, {
        importId: uploaded.importId,
      });
    };
    await applySs01("101");
    expect(await queued()).toEqual(["periods", "ss01"]);
    const transferred = await expectWrites(
      `${sections}#transferSectionAction`,
      {
        termId: term.id,
        sectionRef: "30101",
        fromNumber: trainer.employeeNumber,
        toUserId: teacher.userId,
        week: 2,
        reason: "Workload",
      },
    );
    expect(transferred.status).toBe("transferred");
    expect(await queued()).toEqual(["periods", "ss01", "transfer"]);
    // A newer SS01 that still names the trainer replaced is in conflict with it, which the head keeps.
    await applySs01("102");
    await expectWrites(`${sections}#keepTransferAction`, {
      id: transferred.id,
    });
    await expectWrites(`${sections}#cancelTransferAction`, {
      id: transferred.id,
    });
    expect(await queued()).toEqual([
      "periods",
      "ss01",
      "transfer",
      "ss01",
      "transfer",
    ]);

    // The term's framework: a draft and its items, endorsed and published, then the next version
    // without one of them (Step 15).
    const framework = "(app)/framework/actions.ts";
    const [{ id: axisId }] = await query(
      "select id from axes where code = '3'",
    );
    const [{ id: roleId }] = await query(
      "select id from roles where college_id = $1 and key = 'trainer'",
      [collegeId],
    );
    const analysis = {
      title: "Grade analysis",
      axisId,
      kind: "grade_analysis",
      appliesTo: { type: "role", roleId },
      due: {
        type: "examPeriods",
        periodTypes: ["first-periodic"],
        side: "after",
        weeks: 1,
      },
      evidence: {
        required: true,
        types: ["pdf"],
        maxFiles: 2,
        requiresApproval: false,
      },
      notes: "",
    };
    const draft = await expectWrites(`${framework}#startDraftAction`, {
      termId: term.id,
    });
    const added = await expectWrites(`${framework}#addItemAction`, {
      draftId: draft.id,
      ...analysis,
    });
    await expectWrites(`${framework}#updateItemAction`, {
      itemId: added.id,
      ...analysis,
      notes: "A week after each exam",
    });
    await expectWrites(`${framework}#endorseDraftAction`, {
      draftId: draft.id,
    });
    await expectWrites(`${framework}#publishDraftAction`, {
      draftId: draft.id,
    });
    expect((await queued()).at(-1)).toBe("framework");
    // Electrical's plan: a draft and its item, added, corrected and moved a week, then published,
    // which queues a pass; the wizard copies it into the next term, and the term's next version
    // starts from it with its item taken out (Step 19).
    const plan = "(app)/plan/actions.ts";
    const examCopy = {
      ...analysis,
      title: "Midterm exam copy",
      kind: "exam_copy",
      appliesTo: { type: "eachCourse" },
    };
    const started = await expectWrites(`${plan}#startPlanAction`, {
      termId: term.id,
      departmentId: created.id,
    });
    const item = await expectWrites(`${plan}#addPlanItemAction`, {
      planId: started.id,
      ...examCopy,
    });
    await expectWrites(`${plan}#updatePlanItemAction`, {
      itemId: item.id,
      ...examCopy,
      due: { type: "week", week: 7 },
    });
    await expectWrites(`${plan}#movePlanItemsAction`, {
      moves: [{ itemId: item.id, week: 8 }],
    });
    await expectWrites(`${plan}#publishPlanAction`, { planId: started.id });
    expect((await queued()).at(-1)).toBe("plan");
    await expectWrites(`${terms}#openNextTermAction`, {
      fromId: term.id,
      name: "Autumn 1448",
      startsOn: "2026-08-23",
      weeks: 18,
    });
    const version = await expectWrites(`${framework}#startDraftAction`, {
      termId: term.id,
    });
    const [copy] = await query(
      "select id from framework_items where framework_id = $1",
      [version.id],
    );
    await expectWrites(`${framework}#removeItemAction`, { itemId: copy.id });
    const nextPlan = await expectWrites(`${plan}#startPlanAction`, {
      termId: term.id,
      departmentId: created.id,
    });
    const [copied] = await query(
      "select id from plan_items where plan_id = $1",
      [nextPlan.id],
    );
    await expectWrites(`${plan}#removePlanItemsAction`, {
      itemIds: [copied.id],
    });
    // Electrical's own template, given to the imported trainer for the term, then renamed, with an
    // item added, corrected and taken out, each change queuing a pass for that term; the
    // secretary's given to the same trainer, which queues a pass, and revoked, which queues another;
    // then the department's template taken back and taken out (Step 21; Audit 7, minor 2).
    const assignments = "(app)/assignments/actions.ts";
    const own = await expectWrites(`${assignments}#createTemplateAction`, {
      departmentId: created.id,
      title: "Inventory officer",
      axisId,
    });
    const [{ userId: newcomer }] = await query(
      `select user_id as "userId" from people where employee_number = '6001'`,
    );
    // A template that grants no role writes the assignment's event alone.
    const ownGiven = await run(`${assignments}#assignAction`, {
      templateId: own.id,
      termId: term.id,
      departmentId: created.id,
      userIds: [newcomer],
    });
    expect(ownGiven.written).toEqual(["assignment.create"]);
    const passes = async () =>
      (await queued()).filter((reason) => reason === "assignment").length;
    const given = await passes();
    await expectWrites(`${assignments}#updateTemplateAction`, {
      templateId: own.id,
      title: "Inventory and stores officer",
      axisId,
    });
    const duty = {
      title: "Count the stores",
      kind: "general",
      evidence: {
        required: false,
        types: ["pdf"],
        maxFiles: 1,
        requiresApproval: false,
      },
    };
    const ownItem = await expectWrites(`${assignments}#addTemplateItemAction`, {
      templateId: own.id,
      ...duty,
    });
    await expectWrites(`${assignments}#updateTemplateItemAction`, {
      itemId: ownItem.id,
      ...duty,
      title: "Count the stores at the term's end",
    });
    await expectWrites(`${assignments}#removeTemplateItemAction`, {
      itemId: ownItem.id,
    });
    expect(await passes()).toBe(given + 4);
    const [{ id: secretary }] = await query(
      "select id from assignment_templates where key = 'secretary'",
    );
    await expectWrites(`${assignments}#assignAction`, {
      templateId: secretary,
      termId: term.id,
      departmentId: created.id,
      userIds: [newcomer],
    });
    expect(await passes()).toBe(given + 5);
    const heldOf = async (templateId: string) =>
      (
        await query(
          "select id from assignments where user_id = $1 and template_id = $2",
          [newcomer, templateId],
        )
      )[0].id as string;
    await expectWrites(`${assignments}#revokeAssignmentAction`, {
      assignmentId: await heldOf(secretary),
    });
    expect(await passes()).toBe(given + 6);
    const ownTaken = await run(`${assignments}#revokeAssignmentAction`, {
      assignmentId: await heldOf(own.id as string),
    });
    expect(ownTaken.written).toEqual(["assignment.revoke"]);
    await expectWrites(`${assignments}#deleteTemplateAction`, {
      templateId: own.id,
    });
    await expectWrites(`${terms}#activateTermAction`, { id: term.id });
    await expectWrites(`${terms}#closeTermAction`, { id: term.id });
    // The next Eid break, its last day a day later (ADR-0018).
    const [next] = await query(
      `select id, to_char(starts_on, 'YYYY-MM-DD') as "startsOn",
         to_char(ends_on + 1, 'YYYY-MM-DD') as "endsOn"
       from holidays where starts_on > current_date order by starts_on limit 1`,
    );
    await expectWrites(`${terms}#updateHolidayAction`, next);

    // A portfolio axis's description (Step 14).
    const [axis] = await query("select id, title from axes where code = '7'");
    await expectWrites("(app)/axes/actions.ts#updateAxisAction", {
      id: axis.id,
      title: axis.title,
      description: "Courses on the learning platform",
    });
  });

  it("turning one's own two-factor off writes account.disableTwoFactor, by its owner", async () => {
    const owner = await person("A Head");
    browser.cookies.clear();
    await run(
      "(auth)/actions.ts#signInAction",
      {},
      { identifier: owner.email, password: PASSWORD },
    );
    const started = await run(
      "(auth)/actions.ts#startTwoFactorSetupAction",
      {},
      { password: PASSWORD },
    );
    const key = base32Bytes(started.data.secret as string);
    await run(
      "(auth)/actions.ts#confirmTwoFactorSetupAction",
      {},
      { code: totp(key, Date.now()) },
    );

    const turnOff = "(app)/profile/actions.ts#turnOffOwnTwoFactorAction";
    const turned = await run(turnOff, { password: PASSWORD });
    expect(turned.data).toEqual({ status: "off" });
    expect(turned.written).toEqual(writes[turnOff]);
    expect(turned.actors).toEqual([owner.userId]);
  });

  it("ten wrong codes in a row, over two sign-ins, write the lock of the account's codes", async () => {
    const signIn = "(auth)/actions.ts#signInAction";
    const verify = "(auth)/actions.ts#verifyCodeAction";
    const written: string[] = [];
    for (const _challenge of [1, 2]) {
      browser.cookies.clear();
      await run(
        signIn,
        {},
        { identifier: admin.email, password: NEW_PASSWORD },
      );
      for (const _attempt of [1, 2, 3, 4, 5]) {
        written.push(...(await run(verify, {}, { code: "000000" })).written);
      }
    }
    expect(written).toEqual(["account.lockTwoFactor"]);
  });

  it("is every action of every action module, each run here", () => {
    const found = Object.entries(modules).flatMap(([module, exports]) =>
      Object.keys(exports).map((action) => `${module}#${action}`),
    );
    expect(found.sort()).toEqual(Object.keys(writes).sort());
    expect([...ran].sort()).toEqual(Object.keys(writes).sort());
  });
});
