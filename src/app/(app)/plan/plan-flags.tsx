import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PlanItem } from "./plan-item.ts";

// What an item of the draft needs before it is published (the owner's notes, 21 October 2026): a
// time it falls outside the term's weeks, or no one in the department it reaches.
export function PlanFlags({ item }: { item: PlanItem }) {
  const t = useTranslations("plan.flags");
  const flags = [
    item.weeks.length === 0
      ? t("noWeeks")
      : item.outside > 0
        ? t("outside", { count: item.outside })
        : undefined,
    item.weeks.length > 0 && item.tasks === 0 ? t("noOne") : undefined,
  ].filter((flag) => flag !== undefined);
  if (flags.length === 0) return null;
  return (
    <ul className="mt-1 flex flex-col gap-0.5">
      {flags.map((flag) => (
        <li key={flag} className="flex items-center gap-1 text-alert text-xs">
          <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
          {flag}
        </li>
      ))}
    </ul>
  );
}

// How many of the draft's items need something before it is published.
export const flagged = (items: readonly PlanItem[]) =>
  items.filter(
    (item) => item.weeks.length === 0 || item.outside > 0 || item.tasks === 0,
  ).length;
