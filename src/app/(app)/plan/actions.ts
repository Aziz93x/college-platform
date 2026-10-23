"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { viewerAction } from "@/modules/access";
import {
  dueWeeks,
  frameworkLimits,
  type PlanItemInput,
  planItemInput,
  weeksOutside,
} from "@/modules/framework";
import { requestMeta } from "@/modules/identity";
import {
  addPlanItem,
  findPlan,
  findPlanItem,
  movePlanItems,
  publishPlan,
  removePlanItems,
  startPlanDraft,
  updatePlanItem,
} from "@/modules/planning";
import { getSetting } from "@/modules/settings";
import { queueGeneration } from "@/modules/tasks";
import { findTerm } from "@/modules/terms";

// A department's plan for a term (Step 19): plan.edit and plan.publish are held in departments, so
// each action asks for its key in the plan's department, a head in their own. The services write
// the audit events; after a change the page is drawn again, and a published plan queues a pass of
// the generation engine over its term.

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
const drawn = <T extends { status: string }>(result: T, ...took: string[]) => {
  if (took.includes(result.status)) refresh();
  return result;
};

// The weeks of its term a saved item lands in, and how many of its times fall outside the term,
// which the sheet says as it saves (the owner's notes, 21 October 2026).
async function landing(viewer: Viewer, termId: string, item: PlanItemInput) {
  const term = await findTerm(viewer.collegeId, termId);
  const shape = { weeks: term?.weeks ?? 0, periods: term?.periods ?? [] };
  return {
    weeks: dueWeeks(item.due, shape),
    outside: weeksOutside(item.due, shape),
  };
}

export const startPlanAction = viewerAction
  .metadata({ name: "startPlanDraft" })
  .inputSchema(
    z.object({
      termId: z.uuid(),
      departmentId: z.uuid(),
      fromTermId: z.uuid().optional(),
    }),
  )
  .action(
    async ({
      parsedInput: { termId, departmentId, fromTermId },
      ctx: { viewer, requirePermission },
    }) => {
      requirePermission("plan.edit", { departmentId });
      return drawn(
        await startPlanDraft(
          termId,
          departmentId,
          await changeBy(viewer),
          fromTermId,
        ),
        "created",
      );
    },
  );

export const addPlanItemAction = viewerAction
  .metadata({ name: "addPlanItem" })
  .inputSchema(planItemInput.extend({ planId: z.uuid() }))
  .action(
    async ({
      parsedInput: { planId, ...item },
      ctx: { viewer, requirePermission },
    }) => {
      const plan = await findPlan(viewer.collegeId, planId);
      if (!plan) return { status: "notFound" as const };
      requirePermission("plan.edit", { departmentId: plan.departmentId });
      const result = await addPlanItem(
        planId,
        item,
        await changeBy(viewer),
        await accepted(viewer),
      );
      if (result.status !== "saved") return result;
      refresh();
      return { ...result, landing: await landing(viewer, plan.termId, item) };
    },
  );

export const updatePlanItemAction = viewerAction
  .metadata({ name: "updatePlanItem" })
  .inputSchema(planItemInput.extend({ itemId: z.uuid() }))
  .action(
    async ({
      parsedInput: { itemId, ...item },
      ctx: { viewer, requirePermission },
    }) => {
      const found = await findPlanItem(viewer.collegeId, itemId);
      if (!found) return { status: "notFound" as const };
      requirePermission("plan.edit", { departmentId: found.departmentId });
      const result = await updatePlanItem(
        itemId,
        item,
        await changeBy(viewer),
        await accepted(viewer),
      );
      if (result.status !== "saved") return result;
      refresh();
      return { ...result, landing: await landing(viewer, found.termId, item) };
    },
  );

// Items of one draft, by id: those a change moves or takes out together.
const itemIds = z.array(z.uuid()).min(1).max(frameworkLimits.items);

export const movePlanItemsAction = viewerAction
  .metadata({ name: "movePlanItems" })
  .inputSchema(
    z.object({
      moves: z
        .array(
          z.object({
            itemId: z.uuid(),
            week: z.int().min(1).max(frameworkLimits.weeks),
          }),
        )
        .min(1)
        .max(frameworkLimits.items),
    }),
  )
  .action(
    async ({ parsedInput: { moves }, ctx: { viewer, requirePermission } }) => {
      // The service takes items of one plan alone, so the first names the department of all.
      const found = await findPlanItem(viewer.collegeId, moves[0].itemId);
      if (!found) return { status: "notFound" as const };
      requirePermission("plan.edit", { departmentId: found.departmentId });
      return drawn(await movePlanItems(moves, await changeBy(viewer)), "saved");
    },
  );

export const removePlanItemsAction = viewerAction
  .metadata({ name: "removePlanItems" })
  .inputSchema(z.object({ itemIds }))
  .action(
    async ({
      parsedInput: { itemIds },
      ctx: { viewer, requirePermission },
    }) => {
      const found = await findPlanItem(viewer.collegeId, itemIds[0]);
      if (!found) return { status: "notFound" as const };
      requirePermission("plan.edit", { departmentId: found.departmentId });
      return drawn(
        await removePlanItems(itemIds, await changeBy(viewer)),
        "saved",
      );
    },
  );

export const publishPlanAction = viewerAction
  .metadata({ name: "publishPlan" })
  .inputSchema(z.object({ planId: z.uuid() }))
  .action(
    async ({ parsedInput: { planId }, ctx: { viewer, requirePermission } }) => {
      const plan = await findPlan(viewer.collegeId, planId);
      if (!plan) return { status: "notFound" as const };
      requirePermission("plan.publish", { departmentId: plan.departmentId });
      const result = await publishPlan(planId, await changeBy(viewer));
      // The department's tasks follow the version published (Step 20).
      if (result.status === "published") {
        await queueGeneration(viewer.collegeId, result.termId, "plan");
      }
      return drawn(result, "published");
    },
  );
