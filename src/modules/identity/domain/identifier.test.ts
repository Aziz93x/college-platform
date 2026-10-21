import { describe, expect, it } from "vitest";
import { parseIdentifier } from "./identifier.ts";

describe("parseIdentifier", () => {
  it("reads an email, trimmed and lowercased", () => {
    expect(parseIdentifier("  Trainer@Oasis.Example ")).toEqual({
      kind: "email",
      email: "trainer@oasis.example",
    });
  });

  it("reads an employee number typed with Arabic-Indic digits as Latin digits", () => {
    expect(parseIdentifier("٢٠٠١")).toEqual({
      kind: "employeeNumber",
      employeeNumber: "2001",
    });
  });

  it("drops the spaces people type inside an employee number", () => {
    expect(parseIdentifier(" 20 01 ")).toEqual({
      kind: "employeeNumber",
      employeeNumber: "2001",
    });
  });
});
