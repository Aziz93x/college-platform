"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { viewerAction } from "@/modules/access";
import { requestMeta } from "@/modules/identity";
import { quickRequestInput, sendQuickRequest } from "@/modules/requests";
import { itemAssignees, queueGeneration, runNow } from "@/modules/tasks";

// Sends a quick request (Step 22): requests.send held in its department, or across the college for
// one to the whole college. The request is kept with its pass queued, in one transaction, and the
// pass runs here, so its tasks are made at once and each person it gave one is told, once, unless
// they turned such notices off (ADR-0030). When another pass of the term is running, or this one
// fails, the worker runs it within the minute, and the sender reads so: never "try again", which
// would send the request twice (lead review D, M2).
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
    const sent = await sendQuickRequest(
      parsedInput,
      {
        collegeId: viewer.collegeId,
        actorId: viewer.userId,
        ...requestMeta(await headers()),
      },
      (tx) =>
        queueGeneration(viewer.collegeId, parsedInput.termId, "request", tx),
    );
    if (sent.status !== "sent") return sent;
    const pass = await runNow(sent.runId);
    refresh();
    if (pass === "pending") return { status: "pending" as const };
    const reached = await itemAssignees(parsedInput.termId, "request", sent.id);
    return { status: "sent" as const, reached: reached.length };
  });
