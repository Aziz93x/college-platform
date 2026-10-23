"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { viewerAction } from "@/modules/access";
import {
  reauthenticate,
  requestMeta,
  revokeEveryone,
} from "@/modules/identity";
import { rerunPass } from "@/modules/tasks";
import { latinDigits } from "@/platform/validation/form";

// The system page (ADR-0029): running a failed pass of the generation engine again, and signing
// everyone else out, which asks for the password again when it is due (reauthenticate()). Both need
// system.manage; the domain functions write the audit events.

// Typed again on an Arabic keyboard as on a Latin one, as at sign-in.
const password = latinDigits(z.string().min(1).max(128)).optional();

export const rerunPassAction = viewerAction
  .metadata({ name: "rerunPass", permission: "system.manage" })
  .inputSchema(z.object({ runId: z.uuid() }))
  .action(async ({ parsedInput, ctx: { viewer } }) => {
    const status = await rerunPass(viewer.collegeId, parsedInput.runId, {
      actorId: viewer.userId,
      ...requestMeta(await headers()),
    });
    if (status === "queued") refresh();
    return { status };
  });

export const revokeEveryoneAction = viewerAction
  .metadata({ name: "revokeEveryone", permission: "system.manage" })
  .inputSchema(z.object({ password }))
  .action(async ({ parsedInput, ctx: { viewer } }) => {
    const requestHeaders = await headers();
    const confirmed = await reauthenticate(
      parsedInput.password,
      viewer,
      requestHeaders,
    );
    if (confirmed.status !== "confirmed") return confirmed;
    const count = await revokeEveryone(viewer.sessionId, {
      collegeId: viewer.collegeId,
      actorId: viewer.userId,
      ...requestMeta(requestHeaders),
    });
    refresh();
    return { status: "revoked" as const, count };
  });
