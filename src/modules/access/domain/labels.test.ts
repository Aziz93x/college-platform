import { expect, it } from "vitest";
import { roleLabel } from "./labels.ts";

it("names a role in the language asked for, or in the first language it has a name in", () => {
  expect(roleLabel({ ar: "Trainer (ar)", en: "Trainer" }, "en")).toBe(
    "Trainer",
  );
  expect(roleLabel({ ar: "Trainer (ar)" }, "en")).toBe("Trainer (ar)");
  expect(roleLabel({}, "en")).toBe("");
});
