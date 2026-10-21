"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { viewerAction } from "@/modules/access";
import { requestMeta } from "@/modules/identity";
import {
  chooseNotification,
  isNotificationKind,
  markRead,
  type NotificationKind,
} from "@/modules/notifications";

// The bell and the notification center mark the signed-in person's notifications read, and the
// preferences turn a kind off or on for them. Each acts on the person's own notifications only, so
// it needs no key; the services keep to them and write the audit events. After a change the page
// is drawn again, so the bell shows its new count at once.

const kind = z
  .string()
  .refine(isNotificationKind)
  .transform((value) => value as NotificationKind);

// The notifications named (one opened, or those on show), or all of them unread.
export const markReadAction = viewerAction
  .metadata({ name: "markNotificationsRead" })
  .inputSchema(z.object({ ids: z.array(z.uuid()).min(1).max(100).optional() }))
  .action(async ({ parsedInput: { ids }, ctx: { viewer } }) => {
    const count = await markRead(ids ? { ids } : "all", {
      collegeId: viewer.collegeId,
      actorId: viewer.userId,
      ...requestMeta(await headers()),
    });
    if (count > 0) refresh();
    return { count };
  });

export const chooseNotificationAction = viewerAction
  .metadata({ name: "chooseNotification" })
  .inputSchema(z.object({ kind, enabled: z.boolean() }))
  .action(async ({ parsedInput, ctx: { viewer } }) => {
    const result = await chooseNotification(parsedInput, {
      collegeId: viewer.collegeId,
      actorId: viewer.userId,
      ...requestMeta(await headers()),
    });
    if (result.status === "saved") refresh();
    return result;
  });
