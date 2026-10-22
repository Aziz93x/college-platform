"use client";

import { FileUp, LoaderCircle } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FileField } from "@/components/file-field";
import { ActionSwapButton } from "@/components/motion/action-swap";
import type { RayatKind, RowProblem } from "@/modules/rayat";
import { MAX_UPLOAD_BYTES } from "@/platform/files/upload-limit";
import { uploadRayatAction } from "./actions.ts";

const MEGABYTES = MAX_UPLOAD_BYTES / 1024 / 1024;

type Report = { message: string; problems?: string[] };

// A report's file for the term on view: sent, checked whole and diffed. A file the import cannot
// apply is reported here, with each row's problem by its line and the file's own headers, and
// nothing of it is kept; one it can waits on the page above, with its diff, to be applied.
export function UploadForm({
  termId,
  termName,
  kind,
}: {
  termId: string;
  termName: string;
  kind: RayatKind;
}) {
  const t = useTranslations("rayat");
  const refusals = useTranslations("actions");
  const format = useFormatter();
  const [file, setFile] = useState<File>();
  const [report, setReport] = useState<Report>();
  const [running, setRunning] = useState(false);
  const [, startTransition] = useTransition();

  // A row's problem, naming the file's own headers.
  const problem = (item: RowProblem, headers: Record<string, string>) => {
    const header = (field: string) => `«${headers[field] ?? field}»`;
    const { line } = item;
    switch (item.problem) {
      case "required":
        return t("problems.required", {
          line,
          fields: format.list(item.fields.map(header)),
        });
      case "department":
      case "departmentInactive":
        return t(`problems.${item.problem}`, { line, value: item.value });
      case "number":
        return t("problems.number", {
          line,
          field: header(item.field),
          value: item.value,
        });
      case "capacity":
        return t("problems.capacity", {
          line,
          capacity: item.capacity,
          enrolled: item.enrolled,
          remaining: item.remaining,
        });
      case "duplicate":
        return t("problems.duplicate", { line, first: item.first });
      case "sectionConflict":
        return t("problems.sectionConflict", {
          line,
          field: header(item.field),
          first: item.first,
        });
    }
  };

  const check = () => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setReport({ message: t("upload.tooBig", { megabytes: MEGABYTES }) });
      return;
    }
    startTransition(async () => {
      setRunning(true);
      setReport(undefined);
      const form = new FormData();
      form.set("termId", termId);
      form.set("kind", kind);
      form.set("file", file);
      const result = await uploadRayatAction(form);
      setRunning(false);
      const outcome = result?.data;
      switch (outcome?.status) {
        case "pending":
          setFile(undefined);
          toast.success(t("upload.checked"));
          return;
        case "invalid":
          setReport({
            message: t("upload.invalid", { total: outcome.total }),
            problems: [
              ...outcome.problems.map((item) => problem(item, outcome.headers)),
              ...(outcome.total > outcome.problems.length
                ? [
                    t("upload.moreProblems", {
                      count: outcome.total - outcome.problems.length,
                    }),
                  ]
                : []),
            ],
          });
          return;
        case "missingColumns":
          setReport({
            message: t("upload.missingColumns", {
              count: outcome.missing.length,
              columns: format.list(outcome.missing.map((name) => `«${name}»`)),
            }),
          });
          return;
        case "termsMixed":
          setReport({
            message: t("upload.termsMixed", {
              terms: format.list(outcome.terms.map((name) => `«${name}»`)),
            }),
          });
          return;
        case "termCodesMixed":
          setReport({
            message: t("upload.termCodesMixed", {
              codes: format.list(outcome.codes),
            }),
          });
          return;
        case "otherTerm":
          setReport({
            message: t("upload.otherTerm", {
              term: outcome.term,
              viewed: termName,
            }),
          });
          return;
        case "unreadable":
        case "empty":
        case "noColumnMap":
        case "termClosed":
        case "unchanged":
          setReport({ message: t(`upload.${outcome.status}`) });
          return;
        default:
          setReport({ message: refusals(result?.serverError ?? "unexpected") });
      }
    });
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        check();
      }}
      className="flex flex-col gap-3"
    >
      <FileField
        label={t("upload.file")}
        file={file}
        onFile={(chosen) => {
          setFile(chosen);
          setReport(undefined);
        }}
        words={{
          choose: t("upload.choose"),
          change: t("upload.change"),
          hint: t("upload.hint", { megabytes: MEGABYTES }),
        }}
      />
      {report ? (
        <div role="alert" className="flex flex-col gap-2 text-sm">
          <p className={report.problems ? "text-alert" : undefined}>
            {report.message}
          </p>
          {report.problems ? (
            <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-lg border bg-background px-4 py-3 text-xs leading-relaxed">
              {report.problems.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div className="flex justify-end">
        <ActionSwapButton
          type="submit"
          disabled={running || !file}
          value={running ? "running" : "idle"}
          items={[
            { id: "idle", label: t("upload.check"), icon: <FileUp /> },
            {
              id: "running",
              label: t("upload.checking"),
              icon: <LoaderCircle className="animate-spin" />,
            },
          ]}
        />
      </div>
    </form>
  );
}
