import { afterAll, beforeAll, expect, it } from "vitest";
import { createTestDatabase } from "./support/database.ts";

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let event: Record<string, unknown>;

const events = async () =>
  (await database.pool.query("select * from audit_events")).rows;

beforeAll(async () => {
  database = await createTestDatabase();
  await database.pool.query(
    "insert into colleges (name, short_name) values ('Test College', 'TC')",
  );
  const { rows } = await database.pool.query(
    `insert into audit_events (college_id, action, entity_type, entity_id)
     select id, 'college.create', 'college', id::text from colleges returning *`,
  );
  event = rows[0];
});

afterAll(() => database?.drop());

it("stores a new audit event", async () => {
  expect(await events()).toEqual([event]);
});

it.each([
  ["UPDATE", "update audit_events set action = 'college.delete'"],
  ["DELETE", "delete from audit_events"],
  ["TRUNCATE", "truncate audit_events"],
])("rejects %s and leaves the event unchanged", async (operation, statement) => {
  await expect(database.pool.query(statement)).rejects.toThrow(
    `audit_events is append-only: ${operation} is not allowed`,
  );
  expect(await events()).toEqual([event]);
});
