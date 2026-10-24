"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { viewerAction } from "@/modules/access";
import { requestMeta } from "@/modules/identity";
import { remindOwners } from "@/modules/readiness";
import { preparesTerms } from "../_shell/term.ts";
import { readinessWords } from "./rows.ts";

// A row of the board: one of the college's by its id, or a department's plan.
const remindInput = z.object({
  termId: z.uuid(),
  row: z.discriminatedUnion("id", [
    z.object({
      id: z.enum(["term", "framework", "people", "rayat", "matched", "tasks"]),
    }),
    z.object({ id: z.literal("plan"), departmentId: z.uuid() }),
  ]),
});

// Reminds the owners of an open row of the readiness board (lead review D, proposal 5), for
// whoever sees the row there: readiness.view in the plan's department or across the college, or,
// for the college's rows, wherever the viewer holds it, as the board shows them to a head. A term
// before it starts is the board's of whoever prepares terms.
export const remindOwnersAction = viewerAction
  .metadata({ name: "remindOwners" })
  .inputSchema(remindInput)
  .action(
    async ({
      parsedInput,
      ctx: { viewer, requirePermission, departmentsFor },
    }) => {
      const reach = departmentsFor("readiness.view");
      const { row } = parsedInput;
      requirePermission(
        "readiness.view",
        row.id === "plan"
          ? { departmentId: row.departmentId }
          : reach === "college" || reach.length === 0
            ? {}
            : { departmentId: reach[0] },
      );
      return remindOwners(
        parsedInput,
        { reach, drafts: preparesTerms(viewer) },
        {
          collegeId: viewer.collegeId,
          actorId: viewer.userId,
          ...requestMeta(await headers()),
        },
        await readinessWords(),
      );
    },
  );
