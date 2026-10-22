import { z } from "zod";
import { oneLine } from "../../../platform/validation/text.ts";

// A short text as someone typed it: each line tidied as one line is, at most one empty line
// between paragraphs, and none around them.
export function paragraphs(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(oneLine)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// What an announcement says, and to whom: a department, or the college with none (ADR-0017). The
// lengths only keep a slip of the keyboard out of the database; they are not a policy anyone sets.
export const announcementInput = z.object({
  departmentId: z.uuid().nullable(),
  title: z.string().transform(oneLine).pipe(z.string().min(1).max(120)),
  body: z.string().transform(paragraphs).pipe(z.string().min(1).max(1000)),
});

export type AnnouncementInput = z.infer<typeof announcementInput>;
