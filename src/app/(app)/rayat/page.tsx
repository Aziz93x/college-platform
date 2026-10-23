import type { Metadata } from "next";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getFormatter, getMessages, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleIndicator,
  CollapsibleTrigger,
} from "@/components/motion/collapsible";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  pendingTransferChanges,
  type Trainer,
  unmatchedTrainers,
} from "@/modules/academics";
import {
  authorize,
  listRoles,
  permittedDepartments,
  requireViewer,
} from "@/modules/access";
import {
  listRayatImports,
  type RayatDiff,
  type RayatImport,
  type RayatKind,
  rayatKinds,
} from "@/modules/rayat";
import { preparesTerms, viewedTerm } from "../_shell/term.ts";
import { PendingButtons, RollbackButton } from "./import-buttons.tsx";
import { UploadForm } from "./upload-form.tsx";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("rayat");
  return { title: t("title") };
}

// Rayat's reports for the term on view (Step 16), for whoever holds rayat.import, across the
// college or in a department (ADR-0019): for each report, the version in force and who uploaded and
// applied it, an upload waiting with its diff, a new file to check, and the versions before. A
// closed term's are shown, and nothing changes them.
export default async function RayatPage() {
  await connection();
  const viewer = await requireViewer();
  const held = permittedDepartments(viewer, "rayat.import");
  if (held !== "college" && held.length === 0) forbidden();
  const scope = { collegeId: viewer.collegeId };
  const [t, { term }] = await Promise.all([
    getTranslations("rayat"),
    viewedTerm(viewer.collegeId, preparesTerms(viewer)),
  ]);
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

  // Whoever manages the people adds a trainer Rayat names from its line (ADR-0022), as the role
  // that completes tasks when the college has one such role.
  const addsPeople = authorize(viewer, "people.manage", scope);
  const [messages, format, sectionWords, imports, unmatched, roles] =
    await Promise.all([
      getMessages(),
      getFormatter(),
      getTranslations("sections"),
      listRayatImports(viewer.collegeId, term.id),
      unmatchedTrainers(viewer.collegeId, term.id),
      addsPeople ? listRoles(viewer.collegeId) : [],
    ]);
  // The transfers a waiting SS01 would change (ADR-0020).
  const changes = imports.some(
    (each) => each.kind === "ss01" && each.status === "pending",
  )
    ? await pendingTransferChanges(viewer.collegeId, term.id)
    : [];
  const teaching = roles.filter(
    (role) => !role.system && role.permissions.includes("task.complete"),
  );
  const addHref = (number: string, departmentId: string) =>
    `/people/new?${new URLSearchParams({
      number,
      department: departmentId,
      ...(teaching.length === 1 ? { role: teaching[0].key } : {}),
    })}`;
  const trainerName = (trainer: Trainer) =>
    trainer.name ?? sectionWords("notOnPlatform", { number: trainer.number });
  const open = term.status !== "closed";
  const when = (at: Date) =>
    format.dateTime(at, { dateStyle: "long", timeStyle: "short" });
  const records = (kind: RayatKind, count: number) =>
    t(`records.${kind}`, { count });
  const by = (name: string | null) => name ?? t("current.unknown");

  return (
    <NextIntlClientProvider
      messages={{
        ui: messages.ui,
        actions: messages.actions,
        rayat: messages.rayat,
      }}
    >
      {header}
      {open ? null : (
        <p className="-mt-2 mb-6 px-1 text-muted-foreground text-sm">
          {t("closed")}
        </p>
      )}
      <div className="flex flex-col gap-6">
        {rayatKinds.map((kind) => {
          const own = imports.filter((each) => each.kind === kind);
          const current = own.find((each) => each.current);
          const pending = own.find((each) => each.status === "pending");
          const earlier = own.filter(
            (each) => each.status !== "pending" && !each.current,
          );
          const report = t(`reports.${kind}.title`);
          return (
            <section
              key={kind}
              aria-labelledby={`rayat-${kind}`}
              className="flex flex-col divide-y rounded-xl border bg-card shadow-xs"
            >
              <header className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                <div className="min-w-0">
                  <h2 id={`rayat-${kind}`} className="font-medium text-base">
                    {report}
                  </h2>
                  <p className="mt-1 max-w-prose text-pretty text-muted-foreground text-sm">
                    {t(`reports.${kind}.description`)}
                  </p>
                </div>
                <div className="shrink-0">
                  <AnimatedBadge
                    status={
                      pending ? "pending" : current ? "success" : "neutral"
                    }
                  >
                    {pending
                      ? t("state.pending")
                      : current
                        ? t("state.applied")
                        : kind === "so01"
                          ? t("state.optional")
                          : t("state.none")}
                  </AnimatedBadge>
                </div>
              </header>

              <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="min-w-0">
                  <h3 className="font-medium text-muted-foreground text-sm">
                    {t("current.title")}
                  </h3>
                  <p className="mt-1 text-sm">
                    {current
                      ? records(kind, current.records)
                      : t("current.none")}
                  </p>
                  {current ? (
                    <Facts
                      facts={[
                        [
                          t("facts.updated"),
                          when(current.appliedAt ?? current.uploadedAt),
                        ],
                        [t("facts.uploadedBy"), by(current.uploadedBy)],
                        ...(current.appliedBy
                          ? [[t("facts.appliedBy"), current.appliedBy] as const]
                          : []),
                      ]}
                    />
                  ) : null}
                </div>
                {current && open ? (
                  <div className="shrink-0">
                    <RollbackButton importId={current.id} report={report} />
                  </div>
                ) : null}
              </div>

              {kind === "ss01" && unmatched.length > 0 ? (
                <div className="flex flex-col gap-2 px-5 py-4 sm:px-6">
                  <h3 className="font-medium text-alert text-sm">
                    {t("unmatched.title")}
                  </h3>
                  <p className="max-w-prose text-pretty text-muted-foreground text-sm">
                    {t("unmatched.description")}
                  </p>
                  <ul className="flex flex-col gap-1 text-sm">
                    {unmatched.map(({ number, sections, departmentId }) => (
                      <li
                        key={number}
                        className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"
                      >
                        <span>
                          {t("unmatched.line", {
                            number,
                            sections: sections.length,
                            refs: format.list(sections),
                          })}
                        </span>
                        {addsPeople ? (
                          <Button asChild variant="outline">
                            <Link href={addHref(number, departmentId)}>
                              {t("unmatched.add", { number })}
                            </Link>
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {pending ? (
                <div className="flex flex-col gap-3 px-5 py-4 sm:px-6">
                  <div>
                    <h3 className="font-medium text-primary text-sm">
                      {t("pending.title")}
                    </h3>
                    <p className="mt-1 text-sm">
                      {t("pending.line", {
                        records: records(kind, pending.records),
                        rows: pending.rows,
                      })}
                    </p>
                    <Facts
                      facts={[
                        [t("facts.uploadedBy"), by(pending.uploadedBy)],
                        [t("facts.uploadedAt"), when(pending.uploadedAt)],
                      ]}
                    />
                  </div>
                  <DiffView kind={kind} diff={pending.diff} />
                  {kind === "ss01" && changes.length > 0 ? (
                    <div>
                      <h4 className="font-medium text-sm">
                        {t("pending.transfers.title")}
                      </h4>
                      <p className="mt-1 max-w-prose text-pretty text-muted-foreground text-sm">
                        {t("pending.transfers.description")}
                      </p>
                      <ul className="mt-2 flex flex-col gap-2 text-sm">
                        {changes.map((change) => (
                          <li
                            key={change.id}
                            className="flex flex-wrap items-center gap-x-3 gap-y-1"
                          >
                            <AnimatedBadge
                              status={
                                change.after === "confirmed"
                                  ? "success"
                                  : change.after === "holds"
                                    ? "pending"
                                    : "alert"
                              }
                            >
                              {sectionWords(`transfers.status.${change.after}`)}
                            </AnimatedBadge>
                            <span>
                              {t("pending.transfers.line", {
                                ref: change.sectionRef,
                                week: change.week,
                                to: trainerName(change.to),
                                from: trainerName(change.from),
                              })}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {open ? <PendingButtons importId={pending.id} /> : null}
                </div>
              ) : null}

              {open ? (
                <div className="px-5 py-4 sm:px-6">
                  <UploadForm
                    termId={term.id}
                    termName={term.name}
                    kind={kind}
                  />
                </div>
              ) : null}

              {earlier.length > 0 ? (
                <div className="px-5 py-4 sm:px-6">
                  <h3 className="font-medium text-muted-foreground text-sm">
                    {t("history.title")}
                  </h3>
                  <ol className="mt-2 flex flex-col gap-2">
                    {earlier.map((each) => (
                      <HistoryLine
                        key={each.id}
                        entry={each}
                        line={t("history.line", {
                          records: records(kind, each.records),
                          by: by(each.uploadedBy),
                          at: when(each.uploadedAt),
                        })}
                        state={t(`history.${each.status as "applied"}`)}
                      />
                    ))}
                  </ol>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </NextIntlClientProvider>
  );
}

// Who did what to a version, and when, each fact under its label.
function Facts({
  facts,
}: {
  facts: readonly (readonly [label: string, value: string])[];
}) {
  return (
    <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
      {facts.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-muted-foreground text-xs">{label}</dt>
          <dd className="text-sm">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function HistoryLine({
  entry,
  line,
  state,
}: {
  entry: RayatImport;
  line: string;
  state: string;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <AnimatedBadge
        status={entry.status === "rolledBack" ? "alert" : "neutral"}
      >
        {state}
      </AnimatedBadge>
      <span className="text-muted-foreground">{line}</span>
    </li>
  );
}

// What an upload changes in the version in force: its counts, and the first records of each change
// by their keys.
async function DiffView({ kind, diff }: { kind: RayatKind; diff: RayatDiff }) {
  const [t, format] = await Promise.all([
    getTranslations("rayat"),
    getFormatter(),
  ]);
  const key = (parts: string[]) => {
    const [first, second, third] = parts;
    return kind === "ss01"
      ? t("keys.ss01", { sectionRef: first })
      : kind === "sf01"
        ? t("keys.sf01", { sectionRef: first, traineeNumber: second })
        : t("keys.so01", {
            subjectCode: first,
            courseNumber: second,
            traineeNumber: third,
          });
  };
  const counts = [
    ["added", "success"],
    ["removed", "alert"],
    ["changed", "pending"],
    ["unchanged", "neutral"],
  ] as const;
  const lines = [
    ...diff.samples.added.map((parts) =>
      t("diff.addedKey", { key: key(parts) }),
    ),
    ...diff.samples.removed.map((parts) =>
      t("diff.removedKey", { key: key(parts) }),
    ),
    ...diff.samples.changed.map(({ key: parts, fields }) =>
      t("diff.changedKey", {
        key: key(parts),
        fields: format.list(
          fields.map((field) => t(`fields.${field}` as "fields.capacity")),
        ),
      }),
    ),
  ];
  const shown =
    diff.samples.added.length +
    diff.samples.removed.length +
    diff.samples.changed.length;
  const hidden = diff.added + diff.removed + diff.changed - shown;
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-2">
        {counts
          .filter(([count]) => diff[count] > 0)
          .map(([count, status]) => (
            <li key={count}>
              <AnimatedBadge status={status}>
                {t(`diff.${count}`, { count: diff[count] })}
              </AnimatedBadge>
            </li>
          ))}
      </ul>
      {lines.length > 0 ? (
        // The log's way to open more, with its chevron (UX review 2).
        <Collapsible className="rounded-lg border bg-card">
          <CollapsibleTrigger className="rounded-lg px-4">
            {t("diff.samples")}
            <CollapsibleIndicator />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto border-t px-4 py-3 text-xs leading-relaxed">
              {lines.map((text) => (
                <li key={text}>{text}</li>
              ))}
              {hidden > 0 ? (
                <li className="text-muted-foreground">
                  {t("diff.more", { count: hidden })}
                </li>
              ) : null}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
}
