"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { tellTransferConflicts, transferStates } from "@/modules/academics";
import { viewerAction } from "@/modules/access";
import { requestMeta } from "@/modules/identity";
import {
  applyRayat,
  discardRayat,
  findRayatImport,
  rayatKinds,
  rollbackRayat,
  uploadRayat,
} from "@/modules/rayat";
import { readTable } from "@/platform/files/table";
import { formFields } from "@/platform/validation/form";

// Rayat's reports for the term on view (Step 16): an upload is read, checked and diffed, and kept
// until it is applied or discarded; the version in force is rolled back to the one before. The
// domain functions write the audit events; after a change the page is drawn again. The file itself
// is read here and never kept.

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

// A version of SS01 coming into force, applied or rolled back to: the heads hear of each transfer it
// puts in conflict or leaves changing nothing (ADR-0020), from the transfers' states before and
// after.
async function tellingHeads<T extends { status: string }>(
  viewer: Viewer,
  importId: string,
  took: string,
  change: () => Promise<T>,
) {
  const found = await findRayatImport(viewer.collegeId, importId);
  const before =
    found?.kind === "ss01"
      ? await transferStates(viewer.collegeId, found.termId)
      : undefined;
  const result = await change();
  if (found && before && result.status === took) {
    await tellTransferConflicts(viewer.collegeId, found.termId, before);
  }
  return result;
}

// rayat.import held anywhere, across the college or in a department: a file is the whole college's
// either way (ADR-0019). The key is checked where it is held, so it is refused only when held
// nowhere.
const importerAction = viewerAction.use(async ({ next, ctx }) => {
  const held = ctx.departmentsFor("rayat.import");
  ctx.requirePermission(
    "rayat.import",
    held === "college" ? {} : { departmentId: held[0] },
  );
  return next();
});

export const uploadRayatAction = importerAction
  .metadata({ name: "uploadRayat" })
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

export const applyRayatAction = importerAction
  .metadata({ name: "applyRayat" })
  .inputSchema(z.object({ importId: z.uuid() }))
  .action(async ({ parsedInput: { importId }, ctx: { viewer } }) =>
    drawn(
      await tellingHeads(viewer, importId, "applied", async () =>
        applyRayat(importId, await changeBy(viewer)),
      ),
      "applied",
    ),
  );

export const discardRayatAction = importerAction
  .metadata({ name: "discardRayat" })
  .inputSchema(z.object({ importId: z.uuid() }))
  .action(async ({ parsedInput: { importId }, ctx: { viewer } }) =>
    drawn(await discardRayat(importId, await changeBy(viewer)), "discarded"),
  );

export const rollbackRayatAction = importerAction
  .metadata({ name: "rollbackRayat" })
  .inputSchema(z.object({ importId: z.uuid() }))
  .action(async ({ parsedInput: { importId }, ctx: { viewer } }) =>
    drawn(
      await tellingHeads(viewer, importId, "rolledBack", async () =>
        rollbackRayat(importId, await changeBy(viewer)),
      ),
      "rolledBack",
    ),
  );
