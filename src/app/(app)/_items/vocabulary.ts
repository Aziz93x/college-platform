import type { getFormatter, getTranslations } from "next-intl/server";
import { type DueRule, taskKinds } from "@/modules/framework";
import { calendarEventKinds } from "@/modules/terms";
import type { ItemInput, ItemOptions } from "./item-sheet.tsx";
import type { ItemView } from "./item-words.tsx";

const DUE_TYPES = ["week", "weekly", "everyWeeks", "afterEvent"] as const;

// The words of the items of the framework (Step 15) and of a department's section templates
// (Step 18), and the choices their sheet offers, as their pages write them: the college's axes,
// the kinds, its roles where the item chooses whom it reaches, the kinds of calendar day, the file
// types it accepts and the kinds of due rule.
export function itemVocabulary({
  t,
  calendarWords,
  format,
  axes,
  roles,
  accepted,
}: {
  t: Awaited<ReturnType<typeof getTranslations<"framework">>>;
  calendarWords: Awaited<ReturnType<typeof getTranslations<"terms.kinds">>>;
  format: Awaited<ReturnType<typeof getFormatter>>;
  axes: readonly { id: string; code: string; title: string }[];
  /** The roles an item may reach, by id; none for a section template. */
  roles?: ReadonlyMap<string, string>;
  accepted: readonly string[];
}) {
  const axisWords = new Map(
    axes.map((axis) => [
      axis.id,
      t("axisOption", { code: axis.code, title: axis.title }),
    ]),
  );
  // The items' services take only a calendar's kinds (Audit 5).
  const eventWords = (kind: string) =>
    calendarWords(kind as (typeof calendarEventKinds)[number]);
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
      case "afterEvent":
        return t("dueText.afterEvent", {
          event: eventWords(due.eventKind),
          weeks: due.weeks,
        });
    }
  };
  // A section template reaches each section's trainer of its department.
  const view = (item: ItemInput & { id: string }): ItemView => ({
    ...item,
    words: {
      axis: axisWords.get(item.axisId) ?? "",
      kind: t(`kinds.${item.kind}`),
      appliesTo:
        !item.appliesTo || item.appliesTo.type === "eachSection"
          ? t("eachSection")
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
    eventKinds: calendarEventKinds.map((kind) => ({
      value: kind,
      label: calendarWords(kind),
    })),
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
