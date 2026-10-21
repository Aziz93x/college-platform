"use client";

import {
  ArrowRight,
  Building2,
  History,
  KeyRound,
  Landmark,
  LogIn,
  type LucideIcon,
  Settings,
  UserPen,
  UsersRound,
} from "lucide-react";
import { LayoutGroup } from "motion/react";
import * as m from "motion/react-m";
import { useTranslations } from "next-intl";
import { useId } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleIndicator,
  CollapsibleTrigger,
} from "@/components/motion/collapsible";
import type { Change } from "./describe.ts";

// An event as the page sends it: its words already chosen, its day and time already written.
export type EventRow = {
  id: string;
  // The part of the action before its dot, which picks the event's icon.
  kind: string;
  iso: string;
  day: string;
  time: string;
  actor: string;
  action: string;
  subject: string;
  changes: Change[];
  ip: string | null;
  device: string | null;
};

const ICONS: Record<string, LucideIcon> = {
  account: KeyRound,
  person: UserPen,
  session: LogIn,
  college: Landmark,
  department: Building2,
  role: UsersRound,
  membership: UsersRound,
  setting: Settings,
  audit: History,
};

// The events newest first, a day at a time: who did what to whom, and what changed under each
// one's details. The viewer adds where the request came from.
export function EventList({
  events,
  level,
  origin = false,
}: {
  events: EventRow[];
  // The days' heading level under the page's or the panel's own heading.
  level: 2 | 3;
  origin?: boolean;
}) {
  const id = useId();
  const Heading = level === 2 ? "h2" : "h3";
  const days: { day: string; events: EventRow[] }[] = [];
  for (const event of events) {
    const last = days.at(-1);
    if (last?.day === event.day) last.events.push(event);
    else days.push({ day: event.day, events: [event] });
  }
  return (
    // One layout group: a row that opens moves the rows after it with it.
    <LayoutGroup>
      <div className="flex flex-col gap-6">
        {days.map((group, index) => (
          <section key={group.day} aria-labelledby={`${id}-${index}`}>
            <Heading
              id={`${id}-${index}`}
              className="mb-2 px-1 font-medium text-muted-foreground text-sm"
            >
              {group.day}
            </Heading>
            <ol className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
              {group.events.map((event) => (
                <EventItem key={event.id} event={event} origin={origin} />
              ))}
            </ol>
          </section>
        ))}
      </div>
    </LayoutGroup>
  );
}

// The event's kind, what happened to whom and when, and who did it.
function Summary({ event }: { event: EventRow }) {
  const Icon = ICONS[event.kind] ?? History;
  return (
    <>
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm">
          <span className="font-medium">{event.action}</span> {event.subject}
        </span>
        <span className="mt-0.5 flex items-baseline justify-between gap-4 text-muted-foreground text-xs transition-colors group-hover/row:text-foreground">
          <span className="min-w-0">{event.actor}</span>
          <time dateTime={event.iso} className="shrink-0 tabular-nums">
            {event.time}
          </time>
        </span>
      </span>
    </>
  );
}

// A row; with something to show under it, the whole row opens it.
function EventItem({ event, origin }: { event: EventRow; origin: boolean }) {
  const t = useTranslations("audit");
  const where = origin && (event.ip || event.device);
  if (event.changes.length === 0 && !where) {
    return (
      <m.li layout="position" className="flex gap-3 px-4 py-3 sm:px-5">
        <Summary event={event} />
        {/* The other rows' chevron, so every time lines up. */}
        <span aria-hidden className="size-4 shrink-0" />
      </m.li>
    );
  }
  return (
    <m.li layout="position">
      <Collapsible>
        <CollapsibleTrigger className="group/row items-start rounded-none px-4 py-3 font-normal focus-visible:ring-inset sm:px-5">
          <Summary event={event} />
          <CollapsibleIndicator className="ms-0 mt-2" />
        </CollapsibleTrigger>
        <CollapsibleContent contentClassName="ps-15 pe-4 pb-3 sm:ps-16 sm:pe-5">
          {event.changes.length > 0 ? (
            <dl className="grid gap-2 text-xs sm:grid-cols-[minmax(8rem,auto)_1fr] sm:gap-x-4">
              {event.changes.map((change) => (
                <div key={change.field} className="contents max-sm:block">
                  <dt className="font-medium">{change.field}</dt>
                  <dd className="min-w-0 break-words text-muted-foreground">
                    {change.before === undefined ? (
                      (change.after ?? t("none"))
                    ) : (
                      <>
                        <span className="sr-only">{t("before")}: </span>
                        <del className="no-underline">{change.before}</del>
                        <ArrowRight
                          aria-hidden
                          className="mx-1.5 inline size-3 rtl:-scale-x-100"
                        />
                        <span className="sr-only"> {t("after")}: </span>
                        <ins className="text-foreground no-underline">
                          {change.after ?? t("none")}
                        </ins>
                      </>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          {where ? (
            <dl className="mt-2 grid gap-1 text-muted-foreground text-xs first:mt-0 sm:grid-cols-[minmax(8rem,auto)_1fr] sm:gap-x-4">
              {event.ip ? (
                <div className="contents max-sm:block">
                  <dt>{t("address")}</dt>
                  <dd className="min-w-0">
                    <bdi>{event.ip}</bdi>
                  </dd>
                </div>
              ) : null}
              {event.device ? (
                <div className="contents max-sm:block">
                  <dt>{t("device")}</dt>
                  <dd className="min-w-0 break-all">
                    <bdi>{event.device}</bdi>
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </CollapsibleContent>
      </Collapsible>
    </m.li>
  );
}
