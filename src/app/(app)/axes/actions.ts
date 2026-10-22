"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { viewerAction } from "@/modules/access";
import { axisInput, updateAxis } from "@/modules/axes";
import { requestMeta } from "@/modules/identity";

// The admin corrects a portfolio axis (Step 14): axes.manage, held across the college; the domain
// function writes axis.update, and the page is drawn again.
export const updateAxisAction = viewerAction
  .metadata({ name: "updateAxis", permission: "axes.manage" })
  .inputSchema(axisInput.extend({ id: z.uuid() }))
  .action(async ({ parsedInput: { id, ...input }, ctx: { viewer } }) => {
    const result = await updateAxis(id, input, {
      collegeId: viewer.collegeId,
      actorId: viewer.userId,
      ...requestMeta(await headers()),
    });
    if (result.status === "saved") refresh();
    return result;
  });
