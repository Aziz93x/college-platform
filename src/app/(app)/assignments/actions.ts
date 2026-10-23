"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { viewerAction } from "@/modules/access";
import {
  addTemplateItem,
  assign,
  assignedTerms,
  assignmentInput,
  createTemplate,
  deleteTemplate,
  findAssignment,
  findTemplate,
  findTemplateItem,
  removeTemplateItem,
  revokeAssignment,
  updateTemplate,
  updateTemplateItem,
} from "@/modules/assignments";
import {
  assignmentItemInput,
  assignmentTemplateInput,
} from "@/modules/framework";
import { requestMeta } from "@/modules/identity";
import { getSetting } from "@/modules/settings";
import { queueGeneration } from "@/modules/tasks";

// A department's assignments and its own templates (Step 21): assignment.manage is held in
// departments, so each action asks for it in the department of what it changes, a head in their own;
// a template every department shares is changed by none. The services write the audit events; after
// a change the page is drawn again, and a change that reaches tasks queues a pass of the generation
// engine over each term it reaches.

type Viewer = { userId: string; collegeId: string };

async function changeBy(viewer: Viewer) {
  return {
    collegeId: viewer.collegeId,
    actorId: viewer.userId,
    ...requestMeta(await headers()),
  };
}

// The file types evidence may be, as the college accepts them.
const accepted = (viewer: Viewer) =>
  getSetting("files.acceptedTypes", { collegeId: viewer.collegeId });

// The department a template belongs to, where its key is asked for: across the college for one
// every department shares.
const scopeOf = (departmentId: string | null) =>
  departmentId === null ? {} : { departmentId };

// Each open term that has the template assigned gets a pass: its tasks follow the template.
async function regenerate(viewer: Viewer, templateId: string) {
  for (const termId of await assignedTerms(viewer.collegeId, templateId)) {
    await queueGeneration(viewer.collegeId, termId, "assignment");
  }
}

export const assignAction = viewerAction
  .metadata({ name: "assign" })
  .inputSchema(assignmentInput)
  .action(async ({ parsedInput, ctx: { viewer, requirePermission } }) => {
    requirePermission("assignment.manage", {
      departmentId: parsedInput.departmentId,
    });
    const result = await assign(parsedInput, await changeBy(viewer));
    if (result.status !== "assigned") return result;
    if (result.added > 0) {
      await queueGeneration(viewer.collegeId, parsedInput.termId, "assignment");
    }
    refresh();
    return result;
  });

export const revokeAssignmentAction = viewerAction
  .metadata({ name: "revokeAssignment" })
  .inputSchema(z.object({ assignmentId: z.uuid() }))
  .action(
    async ({
      parsedInput: { assignmentId },
      ctx: { viewer, requirePermission },
    }) => {
      const found = await findAssignment(viewer.collegeId, assignmentId);
      if (!found) return { status: "notFound" as const };
      requirePermission("assignment.manage", {
        departmentId: found.departmentId,
      });
      const result = await revokeAssignment(
        assignmentId,
        await changeBy(viewer),
      );
      if (result.status !== "revoked") return result;
      await queueGeneration(viewer.collegeId, result.termId, "assignment");
      refresh();
      return result;
    },
  );

export const createTemplateAction = viewerAction
  .metadata({ name: "createAssignmentTemplate" })
  .inputSchema(assignmentTemplateInput.extend({ departmentId: z.uuid() }))
  .action(
    async ({
      parsedInput: { departmentId, ...input },
      ctx: { viewer, requirePermission },
    }) => {
      requirePermission("assignment.manage", { departmentId });
      const result = await createTemplate(
        departmentId,
        input,
        await changeBy(viewer),
      );
      if (result.status === "created") refresh();
      return result;
    },
  );

export const updateTemplateAction = viewerAction
  .metadata({ name: "updateAssignmentTemplate" })
  .inputSchema(assignmentTemplateInput.extend({ templateId: z.uuid() }))
  .action(
    async ({
      parsedInput: { templateId, ...input },
      ctx: { viewer, requirePermission },
    }) => {
      const found = await findTemplate(viewer.collegeId, templateId);
      if (!found) return { status: "notFound" as const };
      requirePermission("assignment.manage", scopeOf(found.departmentId));
      const result = await updateTemplate(
        templateId,
        input,
        await changeBy(viewer),
      );
      if (result.status !== "saved") return result;
      // Its tasks take its new axis.
      await regenerate(viewer, templateId);
      refresh();
      return result;
    },
  );

export const deleteTemplateAction = viewerAction
  .metadata({ name: "deleteAssignmentTemplate" })
  .inputSchema(z.object({ templateId: z.uuid() }))
  .action(
    async ({
      parsedInput: { templateId },
      ctx: { viewer, requirePermission },
    }) => {
      const found = await findTemplate(viewer.collegeId, templateId);
      if (!found) return { status: "notFound" as const };
      requirePermission("assignment.manage", scopeOf(found.departmentId));
      const result = await deleteTemplate(templateId, await changeBy(viewer));
      if (result.status === "deleted") refresh();
      return result;
    },
  );

export const addTemplateItemAction = viewerAction
  .metadata({ name: "addAssignmentTemplateItem" })
  .inputSchema(assignmentItemInput.extend({ templateId: z.uuid() }))
  .action(
    async ({
      parsedInput: { templateId, ...item },
      ctx: { viewer, requirePermission },
    }) => {
      const found = await findTemplate(viewer.collegeId, templateId);
      if (!found) return { status: "notFound" as const };
      requirePermission("assignment.manage", scopeOf(found.departmentId));
      const result = await addTemplateItem(
        templateId,
        item,
        await changeBy(viewer),
        await accepted(viewer),
      );
      if (result.status !== "saved") return result;
      await regenerate(viewer, templateId);
      refresh();
      return result;
    },
  );

export const updateTemplateItemAction = viewerAction
  .metadata({ name: "updateAssignmentTemplateItem" })
  .inputSchema(assignmentItemInput.extend({ itemId: z.uuid() }))
  .action(
    async ({
      parsedInput: { itemId, ...item },
      ctx: { viewer, requirePermission },
    }) => {
      const found = await findTemplateItem(viewer.collegeId, itemId);
      if (!found) return { status: "notFound" as const };
      requirePermission("assignment.manage", scopeOf(found.departmentId));
      const result = await updateTemplateItem(
        itemId,
        item,
        await changeBy(viewer),
        await accepted(viewer),
      );
      if (result.status !== "saved") return result;
      await regenerate(viewer, found.templateId);
      refresh();
      return result;
    },
  );

export const removeTemplateItemAction = viewerAction
  .metadata({ name: "removeAssignmentTemplateItem" })
  .inputSchema(z.object({ itemId: z.uuid() }))
  .action(
    async ({ parsedInput: { itemId }, ctx: { viewer, requirePermission } }) => {
      const found = await findTemplateItem(viewer.collegeId, itemId);
      if (!found) return { status: "notFound" as const };
      requirePermission("assignment.manage", scopeOf(found.departmentId));
      const result = await removeTemplateItem(itemId, await changeBy(viewer));
      if (result.status !== "removed") return result;
      await regenerate(viewer, found.templateId);
      refresh();
      return result;
    },
  );
