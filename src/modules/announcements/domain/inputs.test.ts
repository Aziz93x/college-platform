import { expect, it } from "vitest";
import { announcementInput, paragraphs } from "./inputs.ts";

it("keeps an announcement's paragraphs and tidies each line, as a title is tidied", () => {
  expect(
    paragraphs("  First   line \r\n second\tline\n\n\n\nNext  paragraph  \n"),
  ).toBe("First line\nsecond line\n\nNext paragraph");
});

it("asks for a title and a text, to a department or the college", () => {
  const parsed = announcementInput.safeParse({
    departmentId: null,
    title: "  اجتماع   القسم ",
    body: "غدًا\n\n\nفي القاعة ٣",
  });
  expect(parsed.data).toEqual({
    departmentId: null,
    title: "اجتماع القسم",
    body: "غدًا\n\nفي القاعة ٣",
  });
  for (const blank of [
    { departmentId: null, title: "   ", body: "x" },
    { departmentId: null, title: "x", body: " \n \n " },
    { departmentId: "not-an-id", title: "x", body: "x" },
  ]) {
    expect(announcementInput.safeParse(blank).success).toBe(false);
  }
});
