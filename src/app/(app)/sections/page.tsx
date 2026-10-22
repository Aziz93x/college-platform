import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import {
  getFormatter,
  getMessages,
  getTimeZone,
  getTranslations,
} from "next-intl/server";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/empty-state";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import { searchCommands } from "@/components/motion/lib/command-search";
import { PageHeader } from "@/components/page-header";
import {
  listSections,
  type Section,
  type SectionTransfer,
  type Trainer,
  transferCandidates,
  transferLengths,
} from "@/modules/academics";
import {
  authorize,
  permittedDepartments,
  requireViewer,
} from "@/modules/access";
import { listDepartments } from "@/modules/org";
import { termWeeks } from "@/modules/terms";
import { wallClock } from "@/platform/i18n/time-zone";
import { toLatinDigits } from "@/platform/validation/digits";
import { termCalendar, viewedTerm } from "../_shell/term.ts";
import { SectionsFilters } from "./sections-filters.tsx";
import {
  CancelTransferButton,
  KeepTransferButton,
} from "./transfer-buttons.tsx";
import { TransferButton } from "./transfer-sheet.tsx";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("sections");
  return { title: t("title") };
}

const badges = {
  holds: "pending",
  confirmed: "success",
  conflict: "alert",
  otherTrainer: "alert",
} as const;

// A transfer the head must look at: a newer SS01 is in conflict with it, or it changes nothing.
const needsHead = (transfer: SectionTransfer) =>
  transfer.status === "conflict" || transfer.status === "otherTrainer";

// The sections of the term on view (Step 17), one department at a time (ADR-0021): each with its
// course, schedule, numbers and trainers this week, and the transfers made, with what Rayat says
// of each, those that need the head first (ADR-0020). Whoever holds sections.transfer transfers
// the sections of their departments; whoever imports Rayat reads every department's. A closed
// term's are shown, and nothing changes them.
export default async function SectionsPage({
  searchParams,
}: PageProps<"/sections">) {
  await connection();
  const viewer = await requireViewer();
  const transfers = permittedDepartments(viewer, "sections.transfer");
  const imports = permittedDepartments(viewer, "rayat.import");
  const reads =
    imports === "college" || imports.length > 0 ? "college" : transfers;
  if (reads !== "college" && reads.length === 0) forbidden();
  const scope = { collegeId: viewer.collegeId };
  const [t, { term }, params] = await Promise.all([
    getTranslations("sections"),
    viewedTerm(viewer.collegeId, authorize(viewer, "term.manage", scope)),
    searchParams,
  ]);
  const one = (value: string | string[] | undefined) =>
    typeof value === "string" ? value : "";
  const query = one(params.q).slice(0, 100);
  const header = (
    <PageHeader title={t("title")} description={t("description")} />
  );
  if (!term) {
    return (
      <>
        {header}
        <EmptyState
          title={t("noTerm.title")}
          description={t("noTerm.description")}
        />
      </>
    );
  }

  const [messages, format, timeZone, found, departments] = await Promise.all([
    getMessages(),
    getFormatter(),
    getTimeZone(),
    termCalendar(viewer.collegeId, term.id),
    listDepartments(viewer.collegeId),
  ]);
  // This week: the last numbered week begun by today, the first before the term starts.
  const today = wallClock(new Date(), timeZone).slice(0, 10);
  const week =
    (found ? termWeeks(found.calendar) : [])
      .filter((each) => each.number !== null && each.startsOn <= today)
      .at(-1)?.number ?? 1;
  const { sections, gone } = await listSections(
    viewer.collegeId,
    term.id,
    reads,
    week,
  );
  // The departments with sections, or with transfers of sections SS01 dropped, in the college's
  // order; the one chosen, or the first.
  const present = new Set([
    ...sections.map((section) => section.departmentId),
    ...gone.map((transfer) => transfer.departmentId),
  ]);
  const shown = departments.filter(({ id }) => present.has(id));
  const department =
    shown.find(({ id }) => id === one(params.department)) ?? shown[0];
  if (!department) {
    return (
      <>
        {header}
        <EmptyState
          title={t("empty.title")}
          description={t("empty.description")}
        />
      </>
    );
  }

  const open = term.status !== "closed";
  const transfersHere =
    open && (transfers === "college" || transfers.includes(department.id));
  const own = sections.filter(
    (section) => section.departmentId === department.id,
  );
  const name = (trainer: Trainer) =>
    trainer.name ?? t("notOnPlatform", { number: trainer.number });
  // The search's matches, in the page's order: by reference, course, or trainer by name or number.
  const matched = query.trim()
    ? new Set(
        searchCommands(
          own.map((section) => ({
            section,
            label: section.course.name,
            keywords: [
              section.ref,
              section.course.code,
              ...section.trainers.flatMap((trainer) => [
                trainer.number,
                trainer.name ?? "",
              ]),
            ],
          })),
          toLatinDigits(query),
        ).map(({ section }) => section),
      )
    : undefined;
  const listed = own.filter((section) => !matched || matched.has(section));
  const waiting = listed.filter((section) => section.transfers.some(needsHead));
  const ordered = [
    ...waiting,
    ...listed.filter((section) => !waiting.includes(section)),
  ];
  const goneHere = gone.filter(
    (transfer) => transfer.departmentId === department.id,
  );
  const candidates = transfersHere
    ? ((await transferCandidates(viewer.collegeId, [department.id])).get(
        department.id,
      ) ?? [])
    : [];
  const transferLine = (transfer: SectionTransfer) =>
    t("transfers.line", {
      week: transfer.week,
      to: name(transfer.to),
      from: name(transfer.from),
    });
  const transferMeta = (transfer: SectionTransfer) =>
    t("transfers.meta", {
      reason: transfer.reason,
      by: transfer.by ?? t("unknown"),
      at: format.dateTime(transfer.at, { dateStyle: "medium" }),
    });

  return (
    <NextIntlClientProvider
      messages={{
        ui: messages.ui,
        actions: messages.actions,
        sections: messages.sections,
      }}
    >
      {header}
      {open ? null : (
        <p className="-mt-2 mb-6 px-1 text-muted-foreground text-sm">
          {t("closed")}
        </p>
      )}
      <div className="flex flex-col gap-8">
        <SectionsFilters
          departments={shown.length > 1 ? shown : []}
          department={department.id}
          query={query}
          results={listed.length}
        />
        {transfersHere && waiting.length > 0 ? (
          <p className="px-1 text-sm">
            {t("needsHead", { count: waiting.length })}
          </p>
        ) : null}
        {goneHere.length > 0 ? (
          <section
            aria-labelledby="sections-gone"
            className="flex flex-col gap-3 rounded-xl border border-alert/40 bg-card px-5 py-4 shadow-xs sm:px-6"
          >
            <div>
              <h2 id="sections-gone" className="font-medium text-base">
                {t("gone.title")}
              </h2>
              <p className="mt-1 text-muted-foreground text-sm">
                {t("gone.description")}
              </p>
            </div>
            <ul className="flex flex-col gap-3">
              {goneHere.map((transfer) => (
                <li
                  key={transfer.id}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 text-sm">
                    <p>
                      {t("gone.line", {
                        ref: transfer.sectionRef,
                        week: transfer.week,
                        to: name(transfer.to),
                        from: name(transfer.from),
                      })}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {transferMeta(transfer)}
                    </p>
                  </div>
                  {transfersHere ? (
                    <CancelTransferButton
                      id={transfer.id}
                      sectionRef={transfer.sectionRef}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <section
          aria-labelledby={`department-${department.id}`}
          className="flex flex-col gap-4"
        >
          <h2
            id={`department-${department.id}`}
            className={
              shown.length > 1 ? "px-1 font-medium text-base" : "sr-only"
            }
          >
            {department.name}
          </h2>
          <ul className="flex flex-col gap-4">
            {ordered.map((section) => (
              <li key={section.ref}>
                <SectionCard
                  section={section}
                  name={name}
                  transferLine={transferLine}
                  transferMeta={transferMeta}
                  transfer={
                    transfersHere && section.trainers.length > 0 ? (
                      <TransferButton
                        termId={term.id}
                        sectionRef={section.ref}
                        trainers={section.trainers.map((trainer) => ({
                          number: trainer.number,
                          label: name(trainer),
                        }))}
                        candidates={candidates}
                        weeks={term.weeks}
                        week={week}
                        reasonLength={transferLengths.reason}
                      />
                    ) : null
                  }
                  changes={transfersHere}
                />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </NextIntlClientProvider>
  );
}

// A section as a card: its course and reference, its trainers this week, schedule and numbers, and
// its transfers with what Rayat says of each.
async function SectionCard({
  section,
  name,
  transferLine,
  transferMeta,
  transfer,
  changes,
}: {
  section: Section;
  name: (trainer: Trainer) => string;
  transferLine: (transfer: SectionTransfer) => string;
  transferMeta: (transfer: SectionTransfer) => string;
  transfer: ReactNode;
  /** The viewer keeps and cancels the section's transfers. */
  changes: boolean;
}) {
  const [t, format] = await Promise.all([
    getTranslations("sections"),
    getFormatter(),
  ]);
  const id = `section-${section.ref}`;
  return (
    <article
      aria-labelledby={id}
      className="flex flex-col divide-y rounded-xl border bg-card shadow-xs"
    >
      <header className="flex flex-col gap-1 px-5 py-4 sm:px-6">
        <p className="text-muted-foreground text-xs">
          <bdi>{section.course.code}</bdi>
          {section.course.hours === null ? null : (
            <>
              <span aria-hidden> · </span>
              {t("hours", { hours: section.course.hours })}
            </>
          )}
          <span aria-hidden> · </span>
          {section.deliveryMode}
        </p>
        <h3 id={id} className="font-medium text-base">
          {section.course.name}
          <span className="text-muted-foreground"> · </span>
          {t("section", { ref: section.ref })}
        </h3>
      </header>
      <dl className="grid gap-4 px-5 py-4 sm:grid-cols-3 sm:px-6">
        <div className="min-w-0">
          <dt className="text-muted-foreground text-xs">
            {t("trainers", { count: Math.max(section.trainers.length, 1) })}
          </dt>
          <dd className="mt-1 text-sm">
            {section.trainers.length > 0 ? (
              <ul className="flex flex-col gap-0.5">
                {section.trainers.map((trainer) => (
                  <li
                    key={trainer.number}
                    className={trainer.name ? undefined : "text-alert"}
                  >
                    {name(trainer)}
                  </li>
                ))}
              </ul>
            ) : (
              t("noTrainer")
            )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground text-xs">{t("schedule")}</dt>
          <dd className="mt-1 text-sm">
            <ul className="flex flex-col gap-0.5">
              {section.meetings.map((meeting) => (
                <li key={`${meeting.day} ${meeting.time}`}>
                  {t("meeting", { day: meeting.day, time: meeting.time })}
                  {meeting.building ? (
                    <span className="text-muted-foreground">
                      {" · "}
                      {t("place", {
                        building: meeting.building,
                        room: meeting.room,
                      })}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground text-xs">{t("numbers")}</dt>
          <dd className="mt-1 text-sm">
            <p>
              {t("seats", {
                enrolled: section.enrolled,
                capacity: section.capacity,
              })}
            </p>
            {section.registrations.length > 0 ? (
              <p className="text-muted-foreground">
                {t("registrations", {
                  list: format.list(
                    section.registrations.map((registration) =>
                      t("registration", registration),
                    ),
                  ),
                })}
              </p>
            ) : null}
          </dd>
        </div>
      </dl>
      {section.transfers.length > 0 ? (
        <ul className="flex flex-col gap-3 px-5 py-4 sm:px-6">
          {section.transfers.map((each) => (
            <li key={each.id} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <AnimatedBadge status={badges[each.status]}>
                  {t(`transfers.status.${each.status}`)}
                </AnimatedBadge>
                <span>{transferLine(each)}</span>
              </div>
              <p className="text-muted-foreground text-xs">
                {transferMeta(each)}
              </p>
              {each.status === "conflict" ? (
                <p className="text-sm">
                  {t("transfers.conflict", { from: name(each.from) })}
                </p>
              ) : null}
              {each.status === "otherTrainer" ? (
                <p className="text-sm">
                  {t("transfers.otherTrainer", {
                    from: name(each.from),
                    week: each.week,
                  })}
                </p>
              ) : null}
              {changes ? (
                <div className="flex flex-wrap items-start gap-2">
                  {each.status === "conflict" ? (
                    <KeepTransferButton id={each.id} />
                  ) : null}
                  <CancelTransferButton id={each.id} sectionRef={section.ref} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {transfer ? (
        <div className="flex justify-end px-5 py-3 sm:px-6">{transfer}</div>
      ) : null}
    </article>
  );
}
