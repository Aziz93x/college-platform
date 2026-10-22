"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { viewerAction } from "@/modules/access";
import { copyFrameworkInto } from "@/modules/framework";
import { requestMeta } from "@/modules/identity";
import { getSetting } from "@/modules/settings";
import {
  activateTerm,
  addCalendarEvent,
  calendarEventInput,
  calendarSettings,
  closeTerm,
  createTerm,
  openNextTerm,
  removeCalendarEvent,
  termInput,
  updateCalendarEvent,
  updateHoliday,
  updateTerm,
} from "@/modules/terms";
import { wallClock } from "@/platform/i18n/time-zone";

// The vice-dean's terms (Step 13): each action needs term.manage, held across the college, and the
// domain function writes the audit event. After a change the page is drawn again, so the term's
// weeks, its status and its history follow it; a new term's form goes to the term's page.

type Viewer = { userId: string; collegeId: string };

async function changeBy(viewer: Viewer) {
  return {
    collegeId: viewer.collegeId,
    actorId: viewer.userId,
    ...requestMeta(await headers()),
  };
}

const term = z.object({ id: z.uuid() });
const event = calendarEventInput.and(
  z.object({ termId: z.uuid(), eventId: z.uuid() }),
);

export const createTermAction = viewerAction
  .metadata({ name: "createTerm", permission: "term.manage" })
  .inputSchema(termInput)
  .action(async ({ parsedInput, ctx: { viewer } }) =>
    createTerm(parsedInput, await changeBy(viewer)),
  );

export const updateTermAction = viewerAction
  .metadata({ name: "updateTerm", permission: "term.manage" })
  .inputSchema(termInput.extend(term.shape))
  .action(async ({ parsedInput: { id, ...input }, ctx: { viewer } }) => {
    const result = await updateTerm(
      id,
      input,
      await changeBy(viewer),
      await calendarSettings(viewer.collegeId),
    );
    if (result.status === "saved") refresh();
    return result;
  });

export const activateTermAction = viewerAction
  .metadata({ name: "activateTerm", permission: "term.manage" })
  .inputSchema(term)
  .action(async ({ parsedInput: { id }, ctx: { viewer } }) => {
    const result = await activateTerm(id, await changeBy(viewer));
    if (result.status === "activated") refresh();
    return result;
  });

export const closeTermAction = viewerAction
  .metadata({ name: "closeTerm", permission: "term.manage" })
  .inputSchema(term)
  .action(async ({ parsedInput: { id }, ctx: { viewer } }) => {
    const result = await closeTerm(id, await changeBy(viewer));
    if (result.status === "closed") refresh();
    return result;
  });

export const openNextTermAction = viewerAction
  .metadata({ name: "openNextTerm", permission: "term.manage" })
  .inputSchema(termInput.extend({ fromId: z.uuid() }))
  .action(async ({ parsedInput: { fromId, ...input }, ctx: { viewer } }) => {
    const change = await changeBy(viewer);
    // The new term starts with a draft of the framework of the term it opens from (Step 15).
    return openNextTerm(
      fromId,
      input,
      change,
      await calendarSettings(viewer.collegeId),
      undefined,
      (tx, from, to) => copyFrameworkInto(tx, from, to, change),
    );
  });

export const addCalendarEventAction = viewerAction
  .metadata({ name: "addCalendarEvent", permission: "term.manage" })
  .inputSchema(calendarEventInput.and(z.object({ termId: z.uuid() })))
  .action(async ({ parsedInput: { termId, ...input }, ctx: { viewer } }) => {
    const result = await addCalendarEvent(
      termId,
      input,
      await changeBy(viewer),
      await calendarSettings(viewer.collegeId),
    );
    if (result.status === "saved") refresh();
    return result;
  });

export const updateCalendarEventAction = viewerAction
  .metadata({ name: "updateCalendarEvent", permission: "term.manage" })
  .inputSchema(event)
  .action(
    async ({ parsedInput: { termId, eventId, ...input }, ctx: { viewer } }) => {
      const result = await updateCalendarEvent(
        termId,
        eventId,
        input,
        await changeBy(viewer),
        await calendarSettings(viewer.collegeId),
      );
      if (result.status === "saved") refresh();
      return result;
    },
  );

export const removeCalendarEventAction = viewerAction
  .metadata({ name: "removeCalendarEvent", permission: "term.manage" })
  .inputSchema(z.object({ termId: z.uuid(), eventId: z.uuid() }))
  .action(async ({ parsedInput: { termId, eventId }, ctx: { viewer } }) => {
    const result = await removeCalendarEvent(
      termId,
      eventId,
      await changeBy(viewer),
      await calendarSettings(viewer.collegeId),
    );
    if (result.status === "saved") refresh();
    return result;
  });

// A year's Eid break, adjusted once its days are announced (ADR-0018): today is the college's.
export const updateHolidayAction = viewerAction
  .metadata({ name: "updateHoliday", permission: "term.manage" })
  .inputSchema(
    z
      .object({ id: z.uuid(), startsOn: z.iso.date(), endsOn: z.iso.date() })
      .refine(({ startsOn, endsOn }) => startsOn <= endsOn, {
        path: ["endsOn"],
      }),
  )
  .action(async ({ parsedInput: { id, ...days }, ctx: { viewer } }) => {
    const timeZone = await getSetting("locale.timeZone", {
      collegeId: viewer.collegeId,
    });
    const result = await updateHoliday(
      id,
      days,
      await changeBy(viewer),
      wallClock(new Date(), timeZone).slice(0, 10),
      await calendarSettings(viewer.collegeId),
    );
    if (result.status === "saved" || result.status === "approved") refresh();
    return result;
  });
