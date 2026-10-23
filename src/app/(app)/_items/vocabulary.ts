import type { getFormatter, getTranslations } from "next-intl/server";
import {
  type DueRule,
  type EvidencePolicy,
  type PlanReach,
  reachesTrainers,
  type TaskKind,
  taskKinds,
} from "@/modules/framework";
import type { ExamPeriod, ExamPeriodType } from "@/modules/terms";
import type { ItemInput, ItemOptions } from "./item-sheet.tsx";
import type { ItemView } from "./item-words.tsx";

const DUE_TYPES = ["week", "weekly", "everyWeeks", "examPeriods"] as const;
const SIDES = ["before", "after"] as const;

// The words of the items of the framework (Step 15) and of a department's plan (Step 19), and the
// choices their sheet offers, as their pages write them: the college's axes, the kinds, its roles
// and, on a plan, the department's people, its types of exam period with the weeks the term holds
// them in, the file types it accepts and the kinds of due rule.
export function itemVocabulary({
  t,
  periodTypes,
  periods,
  format,
  axes,
  roles,
  people,
  accepted,
}: {
  t: Awaited<ReturnType<typeof getTranslations<"framework">>>;
  /** The college's types of exam period, in order (the owner's notes, 21 October 2026). */
  periodTypes: readonly ExamPeriodType[];
  /** The term's exam periods, which a plan's sheet shows beside their types. */
  periods?: readonly ExamPeriod[];
  format: Awaited<ReturnType<typeof getFormatter>>;
  axes: readonly { id: string; code: string; title: string }[];
  /** The roles an item may reach, by id. */
  roles?: ReadonlyMap<string, string>;
  /** The people of the department a plan's item may reach, by account (Step 19). */
  people?: ReadonlyMap<string, { name: string; employeeNumber: string }>;
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
  // Each field in words, or nothing for an axis, a kind, a role or a person the college no longer
  // has. The audit log words the fields an item's events record with them (UX review 2).
  const words = {
    axis: (id: string) => axisWords.get(id),
    kind: (kind: string) =>
      (taskKinds as readonly string[]).includes(kind)
        ? t(`kinds.${kind as TaskKind}`)
        : undefined,
    appliesTo: (reach: PlanReach) =>
      reachesTrainers(reach)
        ? t(reach.type)
        : "roleId" in reach
          ? roles?.get(reach.roleId)
          : people?.get(reach.userId)?.name,
    due: dueWords,
    evidence: (evidence: EvidencePolicy) =>
      [
        t("evidenceText", {
          required: String(evidence.required),
          types: format.list(evidence.types.map(typeWords)),
          max: evidence.maxFiles,
        }),
        ...(evidence.requiresApproval ? [t("approvalText")] : []),
      ].join(" · "),
  };
  const view = (item: ItemInput & { id: string }): ItemView => ({
    ...item,
    words: {
      axis: words.axis(item.axisId) ?? "",
      kind: t(`kinds.${item.kind}`),
      appliesTo:
        words.appliesTo(item.appliesTo) ??
        ("userId" in item.appliesTo ? t("personGone") : ""),
      due: words.due(item.due),
      evidence: words.evidence(item.evidence),
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
    ...(people && {
      people: [...people].map(([value, { name, employeeNumber }]) => ({
        value,
        label: name,
        employeeNumber,
      })),
    }),
    periodTypes: periodTypes.map(({ code, shortName }) => {
      const period = periods?.find(({ type }) => type === code);
      return {
        value: code,
        label: !periods
          ? shortName
          : !period
            ? t("periodOptionNone", { name: shortName })
            : period.from === period.to
              ? t("periodOptionWeek", { name: shortName, week: period.from })
              : t("periodOptionWeeks", {
                  name: shortName,
                  from: period.from,
                  to: period.to,
                }),
      };
    }),
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
  return { view, options, words };
}
