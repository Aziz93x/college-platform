import { expect, it } from "vitest";
import { axisInput } from "./inputs.ts";

it("keeps an axis's title and description on one line, and refuses an empty title", () => {
  expect(
    axisInput.parse({ title: "  التدريب\nالإلكتروني ", description: " " }),
  ).toEqual({ title: "التدريب الإلكتروني", description: "" });
  expect(axisInput.safeParse({ title: " ", description: "" }).success).toBe(
    false,
  );
});
