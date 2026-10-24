import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { demoAccounts } from "../../db/seed/demo/accounts.ts";
import { demoDepartments } from "../../db/seed/demo/departments.ts";
import { demoVisitor } from "../../db/seed/demo/rayat.ts";
import {
  addMembership,
  disableAccount,
  holdersIn,
  listRoles,
} from "../../src/modules/access/index.ts";
import { listAxes } from "../../src/modules/axes/index.ts";
import { createAccount } from "../../src/modules/identity/index.ts";
import { listDepartments } from "../../src/modules/org/index.ts";
import {
  addPlanItem,
  publishPlan,
  startPlanDraft,
} from "../../src/modules/planning/index.ts";
import {
  type ReadinessRow,
  termReadiness,
} from "../../src/modules/readiness/index.ts";
import { getSetting } from "../../src/modules/settings/index.ts";
import { queueGeneration, runQueued } from "../../src/modules/tasks/index.ts";
import { activeTerm } from "../../src/modules/terms/index.ts";
import {
  createTestDatabase,
  runScript,
  scriptEnv,
} from "./support/database.ts";

// The term readiness board (Step 22) on the demo database: the demo term owes General Studies'
// plan, which its head has not entered, the account of the visitor Electrical's SS01 names, and the
// enabling of the trainer whose account an admin disabled (lead review D, proposal 1).
let database: Awaited<ReturnType<typeof createTestDatabase>>;
let collegeId: string;
let term: NonNullable<Awaited<ReturnType<typeof activeTerm>>>;
const department: Record<string, string> = {};

const board = (reach: "college" | string[] = "college") =>
  termReadiness(collegeId, term, reach, database.db);

// A row as the board reads: what it is, its state and whom it names.
const read = (row: ReadinessRow) => ({
  id: row.id,
  ...(row.id === "plan" ? { department: row.department } : {}),
  state: row.state,
  owners: row.owners.map(({ name }) => name),
});

const nameOf = async (email: string) =>
  (
    await database.pool.query("select id, name from users where email = $1", [
      email,
    ])
  ).rows[0] as { id: string; name: string };

beforeAll(async () => {
  database = await createTestDatabase();
  const seeded = await runScript(
    "db/seed/demo.ts",
    ["--seed", "42"],
    scriptEnv(database.url),
  );
  expect(seeded.code, seeded.stderr).toBe(0);
  [{ id: collegeId }] = (
    await database.pool.query("select id from colleges")
  ).rows;
  const active = await activeTerm(collegeId, database.db);
  if (!active) throw new Error("the demo term is missing");
  term = active;
  for (const each of await listDepartments(collegeId, database.db)) {
    department[each.name] = each.id;
  }
});

afterAll(() => database?.drop());

describe("the term readiness board", () => {
  it("shows what the demo term owes, and whom each row waits on", async () => {
    const generalStudies = demoDepartments[0].name;
    const heads = await holdersIn(
      collegeId,
      Object.values(department),
      "plan.publish",
      database.db,
    );
    const head = (name: string) =>
      (heads.get(department[name]) ?? []).map((each) => each.name);
    const viceDean = (await nameOf(demoAccounts.viceDean.email)).name;
    const admin = (await nameOf(demoAccounts.admin.email)).name;

    const rows = await board();
    expect(rows.map(read)).toEqual([
      { id: "term", state: "done", owners: [viceDean] },
      { id: "framework", state: "done", owners: [viceDean] },
      // Only the admins add people: no other role holds the key across the college.
      { id: "people", state: "done", owners: [admin] },
      { id: "rayat", state: "done", owners: [viceDean] },
      { id: "matched", state: "open", owners: [admin] },
      { id: "tasks", state: "done", owners: [viceDean] },
      // Each department's in the college's order.
      ...Object.keys(department).map((name) => ({
        id: "plan",
        department: name,
        state: name === generalStudies ? "open" : "done",
        owners: head(name),
      })),
    ]);
    expect(rows.find((row) => row.id === "matched")).toMatchObject({
      unmatched: 1,
      disabled: 1,
      imported: true,
      href: "/rayat",
    });
    expect(
      rows.find(
        (row) => row.id === "plan" && row.department === generalStudies,
      ),
    ).toMatchObject({
      href: `/plan?department=${department[generalStudies]}`,
    });
  });

  it("shows a head the college's rows and their own department's plan alone", async () => {
    const electrical = department[demoDepartments[1].name];
    expect(
      (await board([electrical])).map((row) =>
        row.id === "plan" ? row.departmentId : row.id,
      ),
    ).toEqual([
      "term",
      "framework",
      "people",
      "rayat",
      "matched",
      "tasks",
      electrical,
    ]);
  });

  it("turns fully green once the visitor has an account, the disabled trainer's is enabled, and General Studies' plan is published", async () => {
    const admin = await nameOf(demoAccounts.admin.email);
    const roles = await listRoles(collegeId, database.db);
    const trainer = roles.find((role) => role.key === "trainer");
    if (!trainer) throw new Error("the trainer role is missing");
    const visitor = await database.db.transaction(
      async (tx) =>
        (
          await createAccount(
            {
              collegeId,
              name: demoVisitor.name,
              email: "visitor@oasis.example",
              employeeNumber: demoVisitor.employeeNumber,
            },
            tx,
            "visitor-password",
          )
        ).userId,
    );
    await addMembership(
      {
        userId: visitor,
        roleId: trainer.id,
        departmentId: department[demoVisitor.department],
      },
      { collegeId, actorId: admin.id },
      database.db,
    );

    const generalStudies = department[demoDepartments[0].name];
    const [head] =
      (
        await holdersIn(
          collegeId,
          [generalStudies],
          "plan.publish",
          database.db,
        )
      ).get(generalStudies) ?? [];
    const change = { collegeId, actorId: head.userId };
    const draft = await startPlanDraft(
      term.id,
      generalStudies,
      change,
      undefined,
      database.db,
    );
    if (draft.status !== "created") throw new Error(draft.status);
    const [{ axes }] = await listAxes(collegeId, database.db);
    const added = await addPlanItem(
      draft.id,
      {
        title: "ملف المقرر",
        axisId: axes[0].id,
        kind: "general",
        appliesTo: { type: "role", roleId: trainer.id },
        due: { type: "week", week: 5 },
        evidence: {
          required: true,
          types: ["pdf"],
          maxFiles: 1,
          requiresApproval: false,
        },
        notes: "",
      },
      change,
      await getSetting("files.acceptedTypes", { collegeId }, database.db),
      database.db,
    );
    expect(added.status).toBe("saved");
    expect((await publishPlan(draft.id, change, database.db)).status).toBe(
      "published",
    );
    // The trainer whose account is disabled holds their sections' tasks: until an admin enables it,
    // which the people pages do, the row stays open and leads there (lead review D, proposal 1).
    expect((await board()).find((row) => row.id === "matched")).toMatchObject({
      state: "open",
      unmatched: 0,
      disabled: 1,
      href: "/people",
    });
    const disabled = await nameOf(demoAccounts.disabledTrainer.email);
    expect(
      (
        await disableAccount(
          disabled.id,
          false,
          { collegeId, actorId: admin.id },
          database.db,
        )
      ).status,
    ).toBe("saved");

    // Publishing queues a pass, which the worker runs.
    await queueGeneration(collegeId, term.id, "plan", database.db);
    expect((await board()).find((row) => row.id === "tasks")?.state).toBe(
      "working",
    );
    await runQueued(database.db);

    const rows = await board();
    expect(rows.filter((row) => row.state !== "done").map(read)).toEqual([]);
    expect(rows).toHaveLength(6 + demoDepartments.length);
  });
});
