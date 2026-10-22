"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import {
  cancelTransfer,
  findSection,
  findTransfer,
  keepTransfer,
  transferInput,
  transferSection,
} from "@/modules/academics";
import { viewerAction } from "@/modules/access";
import { requestMeta } from "@/modules/identity";
import { queueGeneration } from "@/modules/tasks";

// The sections page transfers a section, keeps a transfer that a newer SS01 is in conflict with,
// and cancels one (Step 17). The key is held in departments, so each action asks for it in the
// section's: a head in their own. The services write the audit events.

type Viewer = { userId: string; collegeId: string };

async function changeBy(viewer: Viewer) {
  return {
    collegeId: viewer.collegeId,
    actorId: viewer.userId,
    ...requestMeta(await headers()),
  };
}

// Draws the page again after a change that took.
const drawn = <T extends { status: string }>(result: T, took: string) => {
  if (result.status === took) refresh();
  return result;
};

export const transferSectionAction = viewerAction
  .metadata({ name: "transferSection" })
  .inputSchema(transferInput)
  .action(async ({ parsedInput, ctx: { viewer, requirePermission } }) => {
    const section = await findSection(
      viewer.collegeId,
      parsedInput.termId,
      parsedInput.sectionRef,
    );
    if (!section) return { status: "notFound" as const };
    requirePermission("sections.transfer", {
      departmentId: section.departmentId,
    });
    const result = await transferSection(parsedInput, await changeBy(viewer));
    // The section's work goes with it to the new trainer (Step 20).
    if (result.status === "transferred") {
      await queueGeneration(viewer.collegeId, parsedInput.termId, "transfer");
    }
    return drawn(result, "transferred");
  });

const transferId = z.object({ id: z.uuid() });

export const keepTransferAction = viewerAction
  .metadata({ name: "keepTransfer" })
  .inputSchema(transferId)
  .action(
    async ({ parsedInput: { id }, ctx: { viewer, requirePermission } }) => {
      const found = await findTransfer(viewer.collegeId, id);
      if (!found) return { status: "notFound" as const };
      requirePermission("sections.transfer", {
        departmentId: found.departmentId,
      });
      return drawn(await keepTransfer(id, await changeBy(viewer)), "kept");
    },
  );

export const cancelTransferAction = viewerAction
  .metadata({ name: "cancelTransfer" })
  .inputSchema(transferId)
  .action(
    async ({ parsedInput: { id }, ctx: { viewer, requirePermission } }) => {
      const found = await findTransfer(viewer.collegeId, id);
      if (!found) return { status: "notFound" as const };
      requirePermission("sections.transfer", {
        departmentId: found.departmentId,
      });
      const result = await cancelTransfer(id, await changeBy(viewer));
      // The section's work still to do goes back (Step 20).
      if (result.status === "cancelled") {
        await queueGeneration(viewer.collegeId, result.termId, "transfer");
      }
      return drawn(result, "cancelled");
    },
  );
