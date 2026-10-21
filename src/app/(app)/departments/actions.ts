"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { viewerAction } from "@/modules/access";
import { requestMeta } from "@/modules/identity";
import {
  collegeInput,
  createDepartment,
  departmentInput,
  updateCollege,
  updateDepartment,
} from "@/modules/org";

// The departments screen adds and saves departments and the college's names. Each action needs
// its permission, and the domain function writes the audit event. After a save the page is drawn
// again, so the header, the shell and the login page show the new names at once; after an addition
// the form goes to the list, which is read afresh.

type Viewer = { userId: string; collegeId: string };

async function changeBy(viewer: Viewer) {
  return {
    collegeId: viewer.collegeId,
    actorId: viewer.userId,
    ...requestMeta(await headers()),
  };
}

export const createDepartmentAction = viewerAction
  .metadata({ name: "createDepartment", permission: "departments.manage" })
  .inputSchema(departmentInput)
  .action(async ({ parsedInput, ctx: { viewer } }) =>
    createDepartment(parsedInput, await changeBy(viewer)),
  );

export const updateDepartmentAction = viewerAction
  .metadata({ name: "updateDepartment", permission: "departments.manage" })
  .inputSchema(departmentInput.extend({ id: z.uuid() }))
  .action(async ({ parsedInput: { id, ...input }, ctx: { viewer } }) => {
    const result = await updateDepartment(id, input, await changeBy(viewer));
    if (result.status === "saved") refresh();
    return result;
  });

export const updateCollegeAction = viewerAction
  .metadata({ name: "updateCollege", permission: "college.manage" })
  .inputSchema(collegeInput)
  .action(async ({ parsedInput, ctx: { viewer } }) => {
    const result = await updateCollege(parsedInput, await changeBy(viewer));
    if (result.status === "saved") refresh();
    return result;
  });
