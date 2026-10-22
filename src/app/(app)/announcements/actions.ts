"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { viewerAction } from "@/modules/access";
import {
  announcementInput,
  findAnnouncement,
  publishAnnouncement,
  withdrawAnnouncement,
} from "@/modules/announcements";
import { requestMeta } from "@/modules/identity";

// The announcements page publishes to a department or the college, and withdraws. The key is
// scoped (ADR-0017), so each action asks for it where it acts: a head in their department, the dean
// and the vice-dean across the college. The services write the audit events.

export const publishAnnouncementAction = viewerAction
  .metadata({ name: "publishAnnouncement" })
  .inputSchema(announcementInput)
  .action(async ({ parsedInput, ctx: { viewer, requirePermission } }) => {
    requirePermission(
      "announcements.publish",
      parsedInput.departmentId
        ? { departmentId: parsedInput.departmentId }
        : {},
    );
    const result = await publishAnnouncement(parsedInput, {
      collegeId: viewer.collegeId,
      actorId: viewer.userId,
      ...requestMeta(await headers()),
    });
    if (result.status === "published") refresh();
    return result;
  });

// Its author withdraws it where they still announce; anyone else needs the key across the college.
export const withdrawAnnouncementAction = viewerAction
  .metadata({ name: "withdrawAnnouncement" })
  .inputSchema(z.object({ id: z.uuid() }))
  .action(async ({ parsedInput, ctx: { viewer, requirePermission } }) => {
    const found = await findAnnouncement(viewer.collegeId, parsedInput.id);
    if (!found) return { status: "notFound" as const };
    requirePermission(
      "announcements.publish",
      found.departmentId ? { departmentId: found.departmentId } : {},
    );
    if (found.authorId !== viewer.userId) {
      requirePermission("announcements.publish");
    }
    const result = await withdrawAnnouncement(parsedInput.id, {
      collegeId: viewer.collegeId,
      actorId: viewer.userId,
      ...requestMeta(await headers()),
    });
    if (result.status === "withdrawn") refresh();
    return result;
  });
