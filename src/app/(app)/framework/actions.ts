"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { viewerAction } from "@/modules/access";
import {
  addItem,
  endorseDraft,
  frameworkItemInput,
  publishDraft,
  removeItem,
  startDraft,
  updateItem,
} from "@/modules/framework";
import { requestMeta } from "@/modules/identity";
import { getSetting } from "@/modules/settings";

// The term's general framework (Step 15): the vice-dean's draft and its publication need
// framework.publish, the dean's endorsement framework.endorse, held across the college. The domain
// function writes the audit event; after a change the page is drawn again.

type Viewer = { userId: string; collegeId: string };

async function changeBy(viewer: Viewer) {
  return {
    collegeId: viewer.collegeId,
    actorId: viewer.userId,
    ...requestMeta(await headers()),
  };
}

// Draws the page again after a change that took.
const drawn = <T extends { status: string }>(result: T, ...took: string[]) => {
  if (took.includes(result.status)) refresh();
  return result;
};

export const startDraftAction = viewerAction
  .metadata({ name: "startFrameworkDraft", permission: "framework.publish" })
  .inputSchema(z.object({ termId: z.uuid() }))
  .action(async ({ parsedInput: { termId }, ctx: { viewer } }) =>
    drawn(await startDraft(termId, await changeBy(viewer)), "created"),
  );

export const addItemAction = viewerAction
  .metadata({ name: "addFrameworkItem", permission: "framework.publish" })
  .inputSchema(frameworkItemInput.extend({ draftId: z.uuid() }))
  .action(async ({ parsedInput: { draftId, ...item }, ctx: { viewer } }) =>
    drawn(await addItem(draftId, item, await changeBy(viewer)), "saved"),
  );

export const updateItemAction = viewerAction
  .metadata({ name: "updateFrameworkItem", permission: "framework.publish" })
  .inputSchema(frameworkItemInput.extend({ itemId: z.uuid() }))
  .action(async ({ parsedInput: { itemId, ...item }, ctx: { viewer } }) =>
    drawn(await updateItem(itemId, item, await changeBy(viewer)), "saved"),
  );

export const removeItemAction = viewerAction
  .metadata({ name: "removeFrameworkItem", permission: "framework.publish" })
  .inputSchema(z.object({ itemId: z.uuid() }))
  .action(async ({ parsedInput: { itemId }, ctx: { viewer } }) =>
    drawn(await removeItem(itemId, await changeBy(viewer)), "saved"),
  );

export const endorseDraftAction = viewerAction
  .metadata({ name: "endorseFramework", permission: "framework.endorse" })
  .inputSchema(z.object({ draftId: z.uuid() }))
  .action(async ({ parsedInput: { draftId }, ctx: { viewer } }) =>
    drawn(await endorseDraft(draftId, await changeBy(viewer)), "endorsed"),
  );

export const publishDraftAction = viewerAction
  .metadata({ name: "publishFramework", permission: "framework.publish" })
  .inputSchema(z.object({ draftId: z.uuid() }))
  .action(async ({ parsedInput: { draftId }, ctx: { viewer } }) => {
    const needsEndorsement = await getSetting("framework.requireEndorsement", {
      collegeId: viewer.collegeId,
    });
    return drawn(
      await publishDraft(draftId, await changeBy(viewer), needsEndorsement),
      "published",
    );
  });
