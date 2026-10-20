import { describe, expect, it } from "vitest";
import { createRandom } from "../../db/seed/demo/random.ts";

const take = (random: () => number, count: number) =>
  Array.from({ length: count }, () => random());

describe("createRandom", () => {
  it("gives the same numbers for the same seed", () => {
    expect(take(createRandom(42), 5)).toEqual(take(createRandom(42), 5));
  });

  it("gives different numbers for different seeds", () => {
    expect(take(createRandom(1), 5)).not.toEqual(take(createRandom(2), 5));
  });

  it("returns values from 0 up to, but not including, 1", () => {
    const values = take(createRandom(42), 1000);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
  });
});
