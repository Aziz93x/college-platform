import { describe, expect, it } from "vitest";
import { parseEnv, parseSeedEnv } from "./env";

const valid = {
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgres://app:app@localhost:5432/app",
  SMTP_URL: "smtp://localhost:1025",
  AUTH_SECRET: "a".repeat(32),
};

describe("parseEnv", () => {
  it("accepts a complete environment and defaults NODE_ENV and APP_ENV", () => {
    expect(parseEnv(valid)).toEqual({
      ...valid,
      NODE_ENV: "development",
      APP_ENV: "production",
    });
  });

  it("names every missing or invalid variable", () => {
    expect(() =>
      parseEnv({ ...valid, DATABASE_URL: "mysql://x", SMTP_URL: undefined }),
    ).toThrow(/DATABASE_URL[\s\S]*SMTP_URL/);
  });

  it("rejects an auth secret shorter than 32 characters", () => {
    expect(() => parseEnv({ ...valid, AUTH_SECRET: "a".repeat(31) })).toThrow(
      /AUTH_SECRET/,
    );
  });

  it("rejects an unknown NODE_ENV", () => {
    expect(() => parseEnv({ ...valid, NODE_ENV: "staging" })).toThrow(
      /NODE_ENV/,
    );
  });

  it("accepts a known APP_ENV and rejects an unknown one", () => {
    expect(parseEnv({ ...valid, APP_ENV: "local" }).APP_ENV).toBe("local");
    expect(() => parseEnv({ ...valid, APP_ENV: "demo" })).toThrow(/APP_ENV/);
  });
});

describe("parseSeedEnv", () => {
  const seed = { SEED_COLLEGE_NAME: "College", SEED_COLLEGE_SHORT_NAME: "C" };

  it("adds the seed college values to the environment", () => {
    expect(parseSeedEnv({ ...valid, ...seed })).toMatchObject(seed);
  });

  it("names the missing or blank seed variables", () => {
    expect(() =>
      parseSeedEnv({ ...valid, SEED_COLLEGE_SHORT_NAME: " " }),
    ).toThrow(/SEED_COLLEGE_NAME[\s\S]*SEED_COLLEGE_SHORT_NAME/);
  });
});
