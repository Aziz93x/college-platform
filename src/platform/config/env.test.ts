import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const valid = {
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgres://app:app@localhost:5432/app",
  SMTP_URL: "smtp://localhost:1025",
};

describe("parseEnv", () => {
  it("accepts a complete environment and defaults NODE_ENV", () => {
    expect(parseEnv(valid)).toEqual({ ...valid, NODE_ENV: "development" });
  });

  it("names every missing or invalid variable", () => {
    expect(() =>
      parseEnv({ ...valid, DATABASE_URL: "mysql://x", SMTP_URL: undefined }),
    ).toThrow(/DATABASE_URL[\s\S]*SMTP_URL/);
  });

  it("rejects an unknown NODE_ENV", () => {
    expect(() => parseEnv({ ...valid, NODE_ENV: "staging" })).toThrow(
      /NODE_ENV/,
    );
  });
});
