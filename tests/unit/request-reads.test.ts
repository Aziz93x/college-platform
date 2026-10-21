import { beforeEach, expect, it, vi } from "vitest";
import { findCollege, findCollegeId } from "../../src/modules/org/index.ts";
import {
  getSetting,
  storedSettings,
} from "../../src/modules/settings/index.ts";

// The reads every page makes, once per request (Step 7): React's cache() keeps a call's result for
// the rest of one server render, keyed on its arguments, each object by identity. Outside a render
// it keeps nothing, so this stand-in keeps results as one render would.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <A extends unknown[], R>(read: (...args: A) => R) => {
    const calls = new Map<unknown, unknown>();
    const result = Symbol("result");
    return (...args: A): R => {
      let node = calls;
      for (const arg of args) {
        if (!node.has(arg)) node.set(arg, new Map());
        node = node.get(arg) as Map<unknown, unknown>;
      }
      if (!node.has(result)) node.set(result, read(...args));
      return node.get(result) as R;
    };
  },
}));

// The database: every query it answers counts as one read. A query ends at where() or limit().
const database = vi.hoisted(() => {
  const state = { reads: 0 };
  const rows = async () => {
    state.reads += 1;
    return [{ id: "college", name: "College", shortName: "C" }];
  };
  const query: Record<string, unknown> = { where: rows, limit: rows };
  for (const step of ["select", "from", "orderBy"]) {
    query[step] = () => query;
  }
  return { state, query };
});
vi.mock("../../src/platform/db/client.ts", () => ({
  getDb: () => database.query,
}));

beforeEach(() => {
  database.state.reads = 0;
});

it("reads the college's settings once for a page and every getSetting in the same render", async () => {
  await storedSettings("college-1");
  await getSetting("locale.timeZone", { collegeId: "college-1" });
  await getSetting("platform.name", { collegeId: "college-1" });
  expect(database.state.reads).toBe(1);
});

it("reads the college once for every caller in the same render", async () => {
  await findCollege();
  await findCollegeId();
  await findCollegeId();
  expect(database.state.reads).toBe(1);
});
