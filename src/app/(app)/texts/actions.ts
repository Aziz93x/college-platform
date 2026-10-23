"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { collegeCatalog } from "@/i18n/catalog";
import { viewerAction } from "@/modules/access";
import { requestMeta } from "@/modules/identity";
import { resetText, setText } from "@/modules/texts";

// The platform's words (ADR-0029): the college's own wording of a text, checked against the
// default it replaces, and the default put back. Both need texts.manage; the domain functions
// write the audit events.

const key = z.string().min(1).max(200);

export const setTextAction = viewerAction
  .metadata({ name: "setText", permission: "texts.manage" })
  .inputSchema(z.object({ key, value: z.string().max(5000) }))
  .action(async ({ parsedInput, ctx: { viewer } }) => {
    const result = await setText(
      parsedInput.key,
      parsedInput.value,
      await collegeCatalog(),
      {
        collegeId: viewer.collegeId,
        actorId: viewer.userId,
        ...requestMeta(await headers()),
      },
    );
    if (result.status === "saved") refresh();
    return result;
  });

export const resetTextAction = viewerAction
  .metadata({ name: "resetText", permission: "texts.manage" })
  .inputSchema(z.object({ key }))
  .action(async ({ parsedInput, ctx: { viewer } }) => {
    const result = await resetText(parsedInput.key, {
      collegeId: viewer.collegeId,
      actorId: viewer.userId,
      ...requestMeta(await headers()),
    });
    if (result.status === "saved") refresh();
    return result;
  });
