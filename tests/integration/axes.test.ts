import { afterAll, beforeAll, expect, it } from "vitest";
import { seedBase } from "../../db/seed/base.ts";
import { listAxes, updateAxis } from "../../src/modules/axes/index.ts";
import { createAccount } from "../../src/modules/identity/index.ts";
import { createTestDatabase } from "./support/database.ts";

// The portfolio's axes (Step 14): the admin corrects a title or description, recorded with what
// it was; the same words change nothing, and another college's axis is not found.
let database: Awaited<ReturnType<typeof createTestDatabase>>;
let collegeId: string;
let actorId: string;

beforeAll(async () => {
  database = await createTestDatabase();
  collegeId = await seedBase(database.db, {
    name: "Test College",
    shortName: "TC",
  });
  actorId = await database.db.transaction(
    async (tx) =>
      (
        await createAccount(
          {
            collegeId,
            name: "Admin",
            email: "admin@college.example",
            employeeNumber: "1001",
          },
          tx,
          "password-admin",
        )
      ).userId,
  );
});

afterAll(() => database.drop());

it("lists the groups in order, each with its axes in order, and corrects an axis once, in the log", async () => {
  const groups = await listAxes(collegeId, database.db);
  expect(groups.flatMap((group) => group.axes.map(({ code }) => code))).toEqual(
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"],
  );
  const axis = groups[1].axes.find(({ code }) => code === "7");
  if (!axis) throw new Error("no axis 7");
  const change = { collegeId, actorId };
  const words = { title: axis.title, description: "المقررات على منصة التعلم" };

  await expect(
    updateAxis(axis.id, words, change, database.db),
  ).resolves.toEqual({
    status: "saved",
  });
  await expect(
    updateAxis(axis.id, words, change, database.db),
  ).resolves.toEqual({
    status: "unchanged",
  });
  await expect(
    updateAxis(axis.id, words, { ...change, collegeId: actorId }, database.db),
  ).resolves.toEqual({ status: "notFound" });
  const { rows } = await database.pool.query(
    "select actor_id, entity_id, diff from audit_events where action = 'axis.update'",
  );
  expect(rows).toEqual([
    {
      actor_id: actorId,
      entity_id: axis.id,
      diff: {
        from: { title: axis.title, description: "" },
        to: words,
      },
    },
  ]);
});
