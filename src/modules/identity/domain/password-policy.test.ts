import { describe, expect, it } from "vitest";
import { newPasswordSchema, temporaryPassword } from "./password-policy.ts";

describe("newPasswordSchema", () => {
  it("takes the college's shortest length and Better Auth's longest", () => {
    const schema = newPasswordSchema(10);
    expect(schema.safeParse("a".repeat(9)).success).toBe(false);
    expect(schema.safeParse("a".repeat(10)).success).toBe(true);
    expect(schema.safeParse("a".repeat(128)).success).toBe(true);
    expect(schema.safeParse("a".repeat(129)).success).toBe(false);
  });
});

describe("temporaryPassword", () => {
  it("makes twelve characters from the alphabet without look-alikes", () => {
    const password = temporaryPassword((length) =>
      crypto.getRandomValues(new Uint8Array(length)),
    );
    expect(password).toMatch(/^[a-hj-km-np-z2-9]{12}$/);
  });

  it("skips bytes past the last full round of the alphabet instead of folding them", () => {
    // 248 is the first byte past the last full round of 31 letters: it is skipped, never read as "a".
    const bytes = [248, 255, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const password = temporaryPassword((length) =>
      Uint8Array.from(bytes.splice(0, length)),
    );
    expect(password).toBe("abcdefghjkmn");
  });
});
