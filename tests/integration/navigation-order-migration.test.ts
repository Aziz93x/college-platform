import { readdirSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
import { defaultNavigationOrder } from "../../db/seed/base.ts";
import { createBlankDatabase } from "./support/database.ts";

// Migration 0025 (UX review 2) on colleges that migration 0024 left: one with no order of pages,
// one that ordered another role's, and one that ordered the head's. Each gets the base seed's
// orders for the vice-dean and the head where it has none of its own.
let database: Awaited<ReturnType<typeof createBlankDatabase>>;
const MIGRATIONS = new URL("../../db/migrations/", import.meta.url);

const query = async (text: string, values: unknown[] = []) =>
  (await database.pool.query(text, values)).rows;

async function apply(file: string) {
  for (const statement of readFileSync(new URL(file, MIGRATIONS), "utf8").split(
    "--> statement-breakpoint",
  )) {
    await database.pool.query(statement);
  }
}

const TRAINER = { trainer: ["framework", "today"] };
const HEAD = { head: ["today", "people"] };
const colleges: string[] = [];

beforeAll(async () => {
  database = await createBlankDatabase();
  const files = readdirSync(MIGRATIONS)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files.filter((file) => file < "0025")) await apply(file);
  for (const [name, order] of [
    ["None", undefined],
    ["Trainer", TRAINER],
    ["Head", HEAD],
  ] as const) {
    const [{ id }] = await query(
      "insert into colleges (name, short_name) values ($1, $1) returning id",
      [name],
    );
    colleges.push(id);
    if (order) {
      await query(
        "insert into settings (college_id, key, value) values ($1, 'navigation.order', $2)",
        [id, order],
      );
    }
  }
  await apply("0025_navigation_order.sql");
});

afterAll(() => database?.drop());

it("gives each college the default roles' orders, keeping the orders it set", async () => {
  const orders = await query(
    "select college_id, value from settings where key = 'navigation.order'",
  );
  const of = (college: string) =>
    orders.find((row) => row.college_id === college)?.value;
  expect(of(colleges[0])).toEqual(defaultNavigationOrder);
  expect(of(colleges[1])).toEqual({ ...defaultNavigationOrder, ...TRAINER });
  expect(of(colleges[2])).toEqual({ ...defaultNavigationOrder, ...HEAD });
});
