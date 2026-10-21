"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { viewerAction } from "@/modules/access";
import { turnOffOwnTwoFactor } from "@/modules/identity";
import { latinDigits } from "@/platform/validation/form";

// The signed-in person's own two-factor (ADR-0014): turning it off needs no key, only their password
// typed again, unless the college requires it of a key they hold. The service writes the audit
// event.
export const turnOffOwnTwoFactorAction = viewerAction
  .metadata({ name: "turnOffOwnTwoFactor" })
  .inputSchema(z.object({ password: latinDigits(z.string().min(1).max(128)) }))
  .action(async ({ parsedInput, ctx: { viewer } }) => {
    if (viewer.twoFactorRequired) return { status: "required" as const };
    const result = await turnOffOwnTwoFactor(
      parsedInput.password,
      viewer,
      await headers(),
    );
    if (result.status === "off") refresh();
    return result;
  });
