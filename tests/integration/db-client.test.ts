import { afterAll, beforeAll, expect, it } from "vitest";
import { createTestDatabase } from "./support/database.ts";

let database: Awaited<ReturnType<typeof createTestDatabase>>;

beforeAll(async () => {
  database = await createTestDatabase();
});

afterAll(() => database?.drop());

it("lets a query wait for a free connection while every one is busy", async () => {
  const { pool } = database;
  const busy = await Promise.all(
    Array.from({ length: pool.options.max }, () => pool.connect()),
  );

  const query = pool.query("select 1 as answer");
  // Longer than the connect timeout the pool used to have, which also failed a query waiting here.
  await new Promise((resolve) => setTimeout(resolve, 2500));
  for (const client of busy) client.release();

  await expect(query).resolves.toMatchObject({ rows: [{ answer: 1 }] });
});
