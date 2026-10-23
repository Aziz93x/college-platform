import type { getFormatter, getTranslations } from "next-intl/server";
import { type DueRule, reachesTrainers, taskKinds } from "@/modules/framework";
import type { ExamPeriodType } from "@/modules/terms";
import type { ItemInput, ItemOptions } from "./item-sheet.tsx";
import type { ItemView } from "./item-words.tsx";

const DUE_TYPES = ["week", "weekly", "everyWeeks", "examPeriods"] as const;
const SIDES = ["before", "after"] as const;

// The words of the items of the framework (Step 15) and of a department's section templates
// (Step 18), and the choices their sheet offers, as their pages write them: the college's axes,
// the kinds, its roles where the item chooses whom it reaches, its types of exam period, the file
// types it accepts and the kinds of due rule.
export function itemVocabulary({
  t,
  periodTypes,
  format,
  axes,
  roles,
  accepted,
}: {
  t: Awaited<ReturnType<typeof getTranslations<"framework">>>;
  /** The college's types of exam period, in order (the owner's notes, 21 October 2026). */
  periodTypes: readonly ExamPeriodType[];
  format: Awaited<ReturnType<typeof getFormatter>>;
  axes: readonly { id: string; code: string; title: string }[];
  /** The roles an item may reach, by id; none for a section template, which reaches trainers. */
  roles?: ReadonlyMap<string, string>;
  accepted: readonly string[];
}) {
  const axisWords = new Map(
    axes.map((axis) => [
      axis.id,
      t("axisOption", { code: axis.code, title: axis.title }),
    ]),
  );
  // A type of exam period by its short name; the items' services take only the college's types.
  const periodWords = new Map(
    periodTypes.map(({ code, shortName }) => [code, shortName]),
  );
  // A file type as people know it: its extension in capitals.
  const typeWords = (type: string) => type.toUpperCase();
  const dueWords = (due: DueRule) => {
    switch (due.type) {
      case "week":
        return t("dueText.week", { week: due.week });
      case "weekly":
        return t("dueText.weekly");
      case "everyWeeks":
        return t("dueText.everyWeeks", { every: due.every });
      case "examPeriods":
        return t("dueText.examPeriods", {
          side: due.side,
          weeks: due.weeks,
          periods: format.list(
            due.periodTypes.map((code) => periodWords.get(code) ?? code),
          ),
        });
    }
  };
  const view = (item: ItemInput & { id: string }): ItemView => ({
    ...item,
    words: {
      axis: axisWords.get(item.axisId) ?? "",
      kind: t(`kinds.${item.kind}`),
      appliesTo: reachesTrainers(item.appliesTo)
        ? t(item.appliesTo.type)
        : (roles?.get(item.appliesTo.roleId) ?? ""),
      due: dueWords(item.due),
      evidence: [
        t("evidenceText", {
          required: String(item.evidence.required),
          types: format.list(item.evidence.types.map(typeWords)),
          max: item.evidence.maxFiles,
        }),
        ...(item.evidence.requiresApproval ? [t("approvalText")] : []),
      ].join(" · "),
    },
  });
  const options: ItemOptions = {
    axes: axes.map((axis) => ({
      value: axis.id,
      label: axisWords.get(axis.id) ?? "",
    })),
    kinds: taskKinds.map((kind) => ({
      value: kind,
      label: t(`kinds.${kind}`),
    })),
    ...(roles && {
      roles: [...roles].map(([value, label]) => ({ value, label })),
    }),
    periodTypes: periodTypes.map(({ code, shortName }) => ({
      value: code,
      label: shortName,
    })),
    sides: SIDES.map((side) => ({ value: side, label: t(`sides.${side}`) })),
    evidenceTypes: accepted.map((type) => ({
      value: type,
      label: typeWords(type),
    })),
    dueTypes: DUE_TYPES.map((type) => ({
      value: type,
      label: t(`dueTypes.${type}`),
    })),
  };
  return { view, options };
}
