"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { viewerAction } from "@/modules/access";
import { requestMeta } from "@/modules/identity";
import {
  applyRayat,
  discardRayat,
  rayatKinds,
  rollbackRayat,
  uploadRayat,
} from "@/modules/rayat";
import { readTable } from "@/platform/files/table";
import { formFields } from "@/platform/validation/form";

// Rayat's reports for the term on view (Step 16), all under rayat.import held across the college:
// an upload is read, checked and diffed, and kept until it is applied or discarded; the version in
// force is rolled back to the one before. The domain functions write the audit events; after a
// change the page is drawn again. The file itself is read here and never kept.

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

export const uploadRayatAction = viewerAction
  .metadata({ name: "uploadRayat", permission: "rayat.import" })
  .inputSchema(
    formFields(
      z.object({
        termId: z.uuid(),
        kind: z.enum(rayatKinds),
        file: z.instanceof(File),
      }),
    ),
  )
  .action(async ({ parsedInput: { termId, kind, file }, ctx: { viewer } }) => {
    const table = await readTable({
      name: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    if (!table) return { status: "unreadable" as const };
    return drawn(
      await uploadRayat(kind, termId, table, await changeBy(viewer)),
      "pending",
    );
  });

export const applyRayatAction = viewerAction
  .metadata({ name: "applyRayat", permission: "rayat.import" })
  .inputSchema(z.object({ importId: z.uuid() }))
  .action(async ({ parsedInput: { importId }, ctx: { viewer } }) =>
    drawn(await applyRayat(importId, await changeBy(viewer)), "applied"),
  );

export const discardRayatAction = viewerAction
  .metadata({ name: "discardRayat", permission: "rayat.import" })
  .inputSchema(z.object({ importId: z.uuid() }))
  .action(async ({ parsedInput: { importId }, ctx: { viewer } }) =>
    drawn(await discardRayat(importId, await changeBy(viewer)), "discarded"),
  );

export const rollbackRayatAction = viewerAction
  .metadata({ name: "rollbackRayat", permission: "rayat.import" })
  .inputSchema(z.object({ importId: z.uuid() }))
  .action(async ({ parsedInput: { importId }, ctx: { viewer } }) =>
    drawn(await rollbackRayat(importId, await changeBy(viewer)), "rolledBack"),
  );
