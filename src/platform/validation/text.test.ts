import { expect, it } from "vitest";
import { canonical } from "./text.ts";

it("writes a value as one text whatever the order of its objects' keys, and keeps its lists' order", () => {
  expect(canonical({ b: 1, a: { d: [2, 1], c: null } })).toBe(
    canonical({ a: { c: null, d: [2, 1] }, b: 1 }),
  );
  expect(canonical({ a: [1, 2] })).not.toBe(canonical({ a: [2, 1] }));
});
