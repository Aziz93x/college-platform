import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getFormatter, getMessages, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { FreshOnReturn } from "@/components/fresh-on-return";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import { PageHeader } from "@/components/page-header";
import { permittedDepartments, requireViewer } from "@/modules/access";
import {
  type ReadinessRow,
  type ReadinessState,
  termReadiness,
} from "@/modules/readiness";
import { preparesTerms, viewedTerm } from "../_shell/term.ts";
import { RemindButton } from "./remind-button.tsx";
import { readinessWords, rowOpens } from "./rows.ts";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("readiness");
  return { title: t("title") };
}

const BADGE = {
  done: "success",
  open: "alert",
  working: "pending",
} as const satisfies Record<ReadinessState, string>;

const card = "rounded-xl border bg-card shadow-xs";

// The term readiness board (Step 22) for the term on view: each responsibility with its state, whom
// it waits on and the page that settles it. Whoever holds readiness.view across the college sees
// every department's plan; a head, the college's rows and their own department's (the owner's
// answer).
export default async function ReadinessPage() {
  await connection();
  const viewer = await requireViewer();
  const reach = permittedDepartments(viewer, "readiness.view");
  if (reach !== "college" && reach.length === 0) forbidden();
  const [t, format, { term }] = await Promise.all([
    getTranslations("readiness"),
    getFormatter(),
    viewedTerm(viewer.collegeId, preparesTerms(viewer)),
  ]);
  // What others do changes the page, so a step back to it reads it again (lead review D).
  const header = (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <FreshOnReturn />
    </>
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

  const [rows, words, messages] = await Promise.all([
    termReadiness(viewer.collegeId, term, reach),
    readinessWords(),
    getMessages(),
  ]);
  const done = rows.filter((row) => row.state === "done").length;
  const opens = rowOpens(viewer);
  // An open row's owners, but the viewer, may be reminded of it while its term is not closed (lead
  // review D, proposal 5).
  const remindable = (row: ReadinessRow) =>
    term.status !== "closed" &&
    row.state === "open" &&
    row.owners.some(({ userId }) => userId !== viewer.userId);
  const list = (shown: ReadinessRow[]) => (
    <ul className="flex flex-col divide-y">
      {shown.map((row) => {
        const { title, detail } = words(row);
        return (
          <li
            key={row.id === "plan" ? row.departmentId : row.id}
            className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
          >
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium text-base">{title}</h3>
                <AnimatedBadge status={BADGE[row.state]}>
                  {t(`states.${row.state}`)}
                </AnimatedBadge>
              </div>
              <p className="text-muted-foreground text-sm">{detail}</p>
              <p className="text-muted-foreground text-sm">
                {row.owners.length > 0
                  ? t("owners", {
                      names: format.list(row.owners.map(({ name }) => name)),
                    })
                  : t("nobody")}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1 self-start sm:self-center">
              {remindable(row) ? (
                <RemindButton
                  termId={term.id}
                  row={
                    row.id === "plan"
                      ? { id: "plan", departmentId: row.departmentId }
                      : { id: row.id }
                  }
                  title={title}
                />
              ) : null}
              {opens(row) ? (
                <Link
                  href={row.href}
                  aria-label={t("openLabel", { title })}
                  className="inline-flex min-h-11 shrink-0 items-center gap-1 self-start rounded-md px-2 text-sm underline-offset-4 hover:underline sm:self-center"
                >
                  {t("open")}
                  <ChevronRight
                    aria-hidden
                    className="size-4 text-muted-foreground rtl:-scale-x-100"
                  />
                </Link>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
  const college = rows.filter((row) => row.id !== "plan");
  const planRows = rows.filter((row) => row.id === "plan");

  return (
    <NextIntlClientProvider
      messages={{
        actions: messages.actions,
        readiness: { remind: messages.readiness.remind },
      }}
    >
      {header}
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <AnimatedBadge status={done === rows.length ? "success" : "pending"}>
            {done === rows.length
              ? t("ready")
              : t("summary", { done, total: rows.length })}
          </AnimatedBadge>
        </div>
        <section aria-labelledby="readiness-college" className={card}>
          <h2
            id="readiness-college"
            className="border-b px-5 py-4 text-lg sm:px-6"
          >
            {t("college")}
          </h2>
          {list(college)}
        </section>
        {planRows.length > 0 ? (
          <section aria-labelledby="readiness-plans" className={card}>
            <h2
              id="readiness-plans"
              className="border-b px-5 py-4 text-lg sm:px-6"
            >
              {t("plans")}
            </h2>
            {list(planRows)}
          </section>
        ) : null}
      </div>
    </NextIntlClientProvider>
  );
}
