"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { viewerAction } from "@/modules/access";
import { reauthenticate, requestMeta } from "@/modules/identity";
import {
  isSettingKey,
  needsPassword,
  resetSetting,
  type SettingKey,
  setSetting,
  settingsRegistry,
} from "@/modules/settings";
import { latinDigits } from "@/platform/validation/digits";

// The settings screen saves and resets one setting at a time. Each needs the setting's own
// permission, a security setting needs the password again (reauthenticate()), and the domain
// function writes the audit event. After a change the page is drawn again, so whatever shows the
// setting (the banner, the names, dates) shows its new value at once.

const key = z
  .string()
  .refine(isSettingKey)
  .transform((value) => value as SettingKey);
// Typed again on an Arabic keyboard as on a Latin one, as at sign-in.
const password = latinDigits(z.string().min(1).max(128)).optional();

type Viewer = { userId: string; sessionId: string; collegeId: string };

async function confirmPassword(
  setting: SettingKey,
  typed: string | undefined,
  viewer: Viewer,
  requestHeaders: Headers,
) {
  if (!needsPassword(setting)) return undefined;
  const result = await reauthenticate(typed, viewer, requestHeaders);
  return result.status === "confirmed" ? undefined : result;
}

export const saveSettingAction = viewerAction
  .metadata({ name: "saveSetting" })
  .inputSchema(z.object({ key, value: z.unknown(), password }))
  .action(async ({ parsedInput, ctx: { viewer, requirePermission } }) => {
    const { key: setting, value } = parsedInput;
    requirePermission(settingsRegistry[setting].permission);
    // A value its schema refuses never asks for the password.
    if (!settingsRegistry[setting].schema.safeParse(value).success) {
      return { status: "invalid" as const };
    }
    const requestHeaders = await headers();
    const refused = await confirmPassword(
      setting,
      parsedInput.password,
      viewer,
      requestHeaders,
    );
    if (refused) return refused;
    const result = await setSetting(setting, value, {
      collegeId: viewer.collegeId,
      actorId: viewer.userId,
      ...requestMeta(requestHeaders),
    });
    if (result.status === "saved") refresh();
    return result;
  });

export const resetSettingAction = viewerAction
  .metadata({ name: "resetSetting" })
  .inputSchema(z.object({ key, password }))
  .action(async ({ parsedInput, ctx: { viewer, requirePermission } }) => {
    const { key: setting } = parsedInput;
    requirePermission(settingsRegistry[setting].permission);
    const requestHeaders = await headers();
    const refused = await confirmPassword(
      setting,
      parsedInput.password,
      viewer,
      requestHeaders,
    );
    if (refused) return refused;
    const result = await resetSetting(setting, {
      collegeId: viewer.collegeId,
      actorId: viewer.userId,
      ...requestMeta(requestHeaders),
    });
    if (result.status === "reset") refresh();
    return result;
  });
