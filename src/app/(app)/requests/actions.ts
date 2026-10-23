"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { getFormatter } from "next-intl/server";
import { viewerAction } from "@/modules/access";
import { requestMeta } from "@/modules/identity";
import { notify } from "@/modules/notifications";
import { quickRequestInput, sendQuickRequest } from "@/modules/requests";
import { generateTerm, itemAssignees } from "@/modules/tasks";

// Sends a quick request (Step 22): requests.send held in its department, or across the college for
// one to the whole college. Its tasks are made at once, by a pass of its own rather than a queued
// one (ADR-0025), and each person it gave one is told, once, unless they turned such notices off.
export const sendQuickRequestAction = viewerAction
  .metadata({ name: "sendQuickRequest" })
  .inputSchema(quickRequestInput)
  .action(async ({ parsedInput, ctx: { viewer, requirePermission } }) => {
    requirePermission(
      "requests.send",
      parsedInput.departmentId === null
        ? {}
        : { departmentId: parsedInput.departmentId },
    );
    const sent = await sendQuickRequest(parsedInput, {
      collegeId: viewer.collegeId,
      actorId: viewer.userId,
      ...requestMeta(await headers()),
    });
    if (sent.status !== "sent") return sent;
    await generateTerm(viewer.collegeId, parsedInput.termId, "request");
    const reached = await itemAssignees(parsedInput.termId, "request", sent.id);
    const format = await getFormatter();
    // A day of the calendar, read on UTC's clock so no time zone moves it.
    const due = format.dateTime(new Date(`${parsedInput.dueOn}T00:00:00Z`), {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
    for (const { userId } of reached) {
      await notify({
        collegeId: viewer.collegeId,
        userId,
        kind: "quickRequest",
        params: {
          requestId: sent.id,
          title: parsedInput.title,
          due,
          from: viewer.name,
        },
        onceKey: `quickRequest:${sent.id}`,
      });
    }
    refresh();
    return { status: "sent" as const, reached: reached.length };
  });
