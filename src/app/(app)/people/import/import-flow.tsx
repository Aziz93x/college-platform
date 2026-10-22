"use client";

import { Copy, Download, FileUp, LoaderCircle, Upload } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FileField } from "@/components/file-field";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import { Table, type TableColumn } from "@/components/motion/table";
import { usePasswordStep } from "@/components/password-step";
import { Button } from "@/components/ui/button";
import type { ImportResult, PeopleRow, PlannedRow } from "@/modules/access";
import { MAX_UPLOAD_BYTES } from "@/platform/files/upload-limit";
import { importPeopleAction, previewPeopleAction } from "../actions.ts";

const OUTCOME_BADGE = {
  new: "success",
  roleAdded: "pending",
  unchanged: "neutral",
  invalid: "alert",
} as const satisfies Record<PlannedRow["outcome"], string>;

type Stage =
  | { name: "choose" }
  | { name: "planned"; rows: PeopleRow[]; plan: PlannedRow[] }
  | { name: "done"; result: ImportResult };

// A people file, in three stages: choosing it (with a template: a file of the columns' names), the
// preview of what each row would do, which writes nothing, and the import with each new account's
// temporary password, shown once.
export function ImportFlow({ columns }: { columns: string[] }) {
  const t = useTranslations("people.import");
  const people = useTranslations("people");
  const refusals = useTranslations("actions");
  const format = useFormatter();
  const [stage, setStage] = useState<Stage>({ name: "choose" });
  const [file, setFile] = useState<File>();
  const [problem, setProblem] = useState<string>();
  const [running, setRunning] = useState(false);
  const [, startTransition] = useTransition();
  const step = usePasswordStep();

  const preview = () => {
    if (!file) return;
    // A bigger file is refused here, with the reason, rather than by the server without one.
    if (file.size > MAX_UPLOAD_BYTES) {
      setProblem(t("tooBig", { megabytes: MAX_UPLOAD_BYTES / 1024 / 1024 }));
      return;
    }
    startTransition(async () => {
      setRunning(true);
      setProblem(undefined);
      const form = new FormData();
      form.set("file", file);
      const result = await previewPeopleAction(form);
      setRunning(false);
      const outcome = result?.data;
      switch (outcome?.status) {
        case "planned":
          setStage({ name: "planned", rows: outcome.rows, plan: outcome.plan });
          return;
        case "missingColumns":
          setProblem(
            t("missingColumns", {
              count: outcome.missing.length,
              columns: format.list(
                outcome.missing.map((column) => t(`columns.${column}`)),
              ),
            }),
          );
          return;
        case "tooManyRows":
          setProblem(t("tooManyRows", { limit: outcome.limit }));
          return;
        case "empty":
        case "unreadable":
          setProblem(t(outcome.status));
          return;
        default:
          setProblem(refusals(result?.serverError ?? "unexpected"));
      }
    });
  };

  const run = (rows: PeopleRow[]) => (password?: string) =>
    startTransition(async () => {
      setRunning(true);
      setProblem(undefined);
      const result = await importPeopleAction({ rows, password });
      setRunning(false);
      const outcome = result?.data;
      if (step.handled(outcome, run(rows))) return;
      if (outcome?.status === "imported") {
        setStage({ name: "done", result: outcome });
        return;
      }
      setProblem(refusals(result?.serverError ?? "unexpected"));
    });

  // The columns' names as a file's header row, for Excel to open as UTF-8.
  const template = () => {
    const blob = new Blob([`\uFEFF${columns.join(",")}\r\n`], {
      type: "text/csv;charset=utf-8",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = t("templateFile");
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const again = () => {
    setStage({ name: "choose" });
    setFile(undefined);
    setProblem(undefined);
    step.cancel();
  };

  const alert = problem ? (
    <p role="alert" className="text-alert text-sm">
      {problem}
    </p>
  ) : null;

  if (stage.name === "done")
    return <Result result={stage.result} onAgain={again} />;

  if (stage.name === "planned") {
    const counts = Object.fromEntries(
      (Object.keys(OUTCOME_BADGE) as PlannedRow["outcome"][]).map((outcome) => [
        outcome,
        stage.plan.filter((row) => row.outcome === outcome).length,
      ]),
    ) as Record<PlannedRow["outcome"], number>;
    const taken = counts.new + counts.roleAdded;
    return (
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!step.confirm()) run(stage.rows)();
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-4 shadow-xs sm:px-6">
          <p className="font-medium text-sm">{t("dryRun")}</p>
          <ul className="flex flex-wrap gap-2">
            {(Object.keys(OUTCOME_BADGE) as PlannedRow["outcome"][]).map(
              (outcome) => (
                <li key={outcome}>
                  <AnimatedBadge status={OUTCOME_BADGE[outcome]}>
                    {`${t(`outcomes.${outcome}`)}: ${counts[outcome]}`}
                  </AnimatedBadge>
                </li>
              ),
            )}
          </ul>
        </div>
        <PlanTable plan={stage.plan} />
        <div className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-4 shadow-xs sm:px-6">
          {step.field(people("reauth"))}
          {taken === 0 ? <p className="text-sm">{t("nothing")}</p> : null}
          {alert}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={again}>
              {t("another")}
            </Button>
            <ActionSwapButton
              type="submit"
              disabled={running || taken === 0}
              value={running ? "running" : step.asking ? "confirm" : "idle"}
              items={[
                {
                  id: "idle",
                  label: t("confirm", { count: taken }),
                  icon: <Upload />,
                },
                {
                  id: "running",
                  label: step.asking ? step.words.confirming : t("importing"),
                  icon: <LoaderCircle className="animate-spin" />,
                },
                { id: "confirm", label: step.words.submit },
              ]}
            />
          </div>
        </div>
      </form>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        preview();
      }}
      className="flex flex-col gap-4 rounded-xl border bg-card px-5 py-5 shadow-xs sm:px-6"
    >
      <FileField
        label={t("file")}
        file={file}
        onFile={(chosen) => {
          setFile(chosen);
          setProblem(undefined);
        }}
        words={{
          choose: t("choose"),
          change: t("change"),
          hint: t("fileHint"),
        }}
      />
      {alert}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={template}
        >
          <Download aria-hidden />
          {t("template")}
        </Button>
        <ActionSwapButton
          type="submit"
          disabled={running || !file}
          value={running ? "running" : "idle"}
          items={[
            { id: "idle", label: t("preview"), icon: <FileUp /> },
            {
              id: "running",
              label: t("previewing"),
              icon: <LoaderCircle className="animate-spin" />,
            },
          ]}
        />
      </div>
    </form>
  );
}

// What each row would do, with the reasons a row cannot be imported.
function PlanTable({ plan }: { plan: PlannedRow[] }) {
  const t = useTranslations("people");
  const columns: TableColumn<PlannedRow>[] = [
    {
      key: "line",
      header: t("import.table.line"),
      sortable: true,
      cell: (row) => <span className="tabular-nums">{row.line}</span>,
    },
    {
      key: "name",
      header: t("import.table.person"),
      sortable: true,
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.name}</span>
          <span className="text-muted-foreground text-xs">
            {row.employeeNumber}
            <span aria-hidden> · </span>
            <bdi>{row.email}</bdi>
          </span>
        </div>
      ),
    },
    {
      key: "role",
      header: t("import.table.role"),
      className: "max-md:hidden",
      // A department the college lacks or set aside is no place: its error says why.
      cell: (row) =>
        row.role ? (
          <span className="text-sm">
            {row.role.label}
            {row.errors.includes("department") ||
            row.errors.includes("departmentInactive") ? null : (
              <>
                <span aria-hidden> · </span>
                {row.department?.name ?? t("college")}
              </>
            )}
          </span>
        ) : null,
    },
    {
      key: "outcome",
      header: t("import.table.outcome"),
      sortable: true,
      sortValue: (row) => Object.keys(OUTCOME_BADGE).indexOf(row.outcome),
      cell: (row) => (
        <div className="flex flex-col items-start gap-1">
          <AnimatedBadge status={OUTCOME_BADGE[row.outcome]}>
            {t(`import.outcomes.${row.outcome}`)}
          </AnimatedBadge>
          {row.errors.length > 0 ? (
            <ul className="text-alert text-xs">
              {row.errors.map((error) => (
                <li key={error}>{t(`import.errors.${error}`)}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ),
    },
  ];
  return (
    <Table
      data={plan}
      columns={columns}
      getRowId={(row) => String(row.line)}
      caption={t("import.table.caption")}
      emptyState={t("import.empty")}
    />
  );
}

// The import's outcome, with each new account's temporary password, shown this once.
function Result({
  result,
  onAgain,
}: {
  result: ImportResult;
  onAgain: () => void;
}) {
  const t = useTranslations("people.import.result");
  const words = useTranslations("people.import");
  const copy = () =>
    navigator.clipboard
      .writeText(
        result.created
          .map((person) =>
            [person.employeeNumber, person.name, person.password].join("\t"),
          )
          .join("\n"),
      )
      .then(() => toast.success(t("copied")));
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card px-5 py-5 shadow-xs sm:px-6">
      <h2 className="font-medium text-base">{t("title")}</h2>
      <ul className="flex flex-col gap-1 text-sm">
        <li>{t("created", { count: result.created.length })}</li>
        <li>{t("rolesAdded", { count: result.rolesAdded })}</li>
        <li>{t("unchanged", { count: result.unchanged })}</li>
        <li>{t("skipped", { count: result.skipped.length })}</li>
      </ul>
      {result.created.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="font-medium text-sm">{t("passwords")}</h3>
          <p className="text-pretty text-muted-foreground text-xs">
            {t("passwordsHint")}
          </p>
          <ul
            aria-label={t("passwords")}
            className="divide-y rounded-lg border"
          >
            {result.created.map((person) => (
              <li
                key={person.userId}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <span className="text-sm">
                  {person.name}
                  <span aria-hidden> · </span>
                  <span className="text-muted-foreground">
                    {person.employeeNumber}
                  </span>
                </span>
                <output
                  dir="ltr"
                  className="select-all font-mono text-sm tracking-wider"
                >
                  {person.password}
                </output>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onAgain}>
          {words("another")}
        </Button>
        {result.created.length > 0 ? (
          <Button type="button" variant="outline" onClick={copy}>
            <Copy aria-hidden />
            {t("copy")}
          </Button>
        ) : null}
        <Button asChild>
          <Link href="/people">{t("back")}</Link>
        </Button>
      </div>
    </section>
  );
}
