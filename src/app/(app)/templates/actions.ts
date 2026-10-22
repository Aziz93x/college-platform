"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { viewerAction } from "@/modules/access";
import { sectionTemplateInput } from "@/modules/framework";
import { requestMeta } from "@/modules/identity";
import {
  addTemplate,
  findTemplate,
  removeTemplate,
  updateTemplate,
} from "@/modules/planning";
import { getSetting } from "@/modules/settings";

// A head's section templates (Step 18): plan.edit is held in departments, so each action asks for
// it in the template's, a head in their own. The services write the audit events; after a change
// the page is drawn again.

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

// Draws the page again after a change that took.
const drawn = <T extends { status: string }>(result: T) => {
  if (result.status === "saved") refresh();
  return result;
};

export const addTemplateAction = viewerAction
  .metadata({ name: "addSectionTemplate" })
  .inputSchema(
    sectionTemplateInput.extend({ termId: z.uuid(), departmentId: z.uuid() }),
  )
  .action(
    async ({
      parsedInput: { termId, departmentId, ...input },
      ctx: { viewer, requirePermission },
    }) => {
      requirePermission("plan.edit", { departmentId });
      return drawn(
        await addTemplate(
          termId,
          departmentId,
          input,
          await changeBy(viewer),
          await accepted(viewer),
        ),
      );
    },
  );

export const updateTemplateAction = viewerAction
  .metadata({ name: "updateSectionTemplate" })
  .inputSchema(sectionTemplateInput.extend({ templateId: z.uuid() }))
  .action(
    async ({
      parsedInput: { templateId, ...input },
      ctx: { viewer, requirePermission },
    }) => {
      const template = await findTemplate(viewer.collegeId, templateId);
      if (!template) return { status: "notFound" as const };
      requirePermission("plan.edit", { departmentId: template.departmentId });
      return drawn(
        await updateTemplate(
          templateId,
          input,
          await changeBy(viewer),
          await accepted(viewer),
        ),
      );
    },
  );

export const removeTemplateAction = viewerAction
  .metadata({ name: "removeSectionTemplate" })
  .inputSchema(z.object({ templateId: z.uuid() }))
  .action(
    async ({
      parsedInput: { templateId },
      ctx: { viewer, requirePermission },
    }) => {
      const template = await findTemplate(viewer.collegeId, templateId);
      if (!template) return { status: "notFound" as const };
      requirePermission("plan.edit", { departmentId: template.departmentId });
      return drawn(await removeTemplate(templateId, await changeBy(viewer)));
    },
  );
