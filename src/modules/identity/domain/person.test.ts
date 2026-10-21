import { describe, expect, it } from "vitest";
import { accountState } from "./account-state.ts";
import { personInput } from "./person.ts";

describe("personInput", () => {
  it("tidies the name, lowercases the email and reads Arabic-Indic digits as Latin", () => {
    expect(
      personInput.parse({
        name: "  سارة   العتيبي ",
        email: " S.Alotaibi@Oasis.Example ",
        employeeNumber: "٢٠٠ ١٠١",
      }),
    ).toEqual({
      name: "سارة العتيبي",
      email: "s.alotaibi@oasis.example",
      employeeNumber: "200101",
    });
  });

  it.each([
    ["an empty name", { name: "   " }],
    ["an address that is not one", { email: "s.alotaibi" }],
    ["letters in the employee number", { employeeNumber: "20A1" }],
    ["an employee number past 20 digits", { employeeNumber: "1".repeat(21) }],
  ])("refuses %s", (_name, change) => {
    const person = {
      name: "سارة العتيبي",
      email: "s.alotaibi@oasis.example",
      employeeNumber: "200101",
      ...change,
    };
    expect(personInput.safeParse(person).success).toBe(false);
  });
});

describe("accountState", () => {
  const account = { disabled: false, locked: false, mustChangePassword: false };

  it("is the first that holds: disabled, locked, invited, then active", () => {
    expect(
      accountState({ disabled: true, locked: true, mustChangePassword: true }),
    ).toBe("disabled");
    expect(
      accountState({ ...account, locked: true, mustChangePassword: true }),
    ).toBe("locked");
    expect(accountState({ ...account, mustChangePassword: true })).toBe(
      "invited",
    );
    expect(accountState(account)).toBe("active");
  });
});
