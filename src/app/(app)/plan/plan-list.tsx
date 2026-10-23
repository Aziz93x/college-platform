"use client";

import { Lock, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { PlanFlags } from "./plan-flags.tsx";
import type { PlanItem } from "./plan-item.ts";

// The plan by weeks on a phone (Step 19): the items that recur through the term first, then each
// week with the items that land in it, an item anchored to several exam periods in each of its
// weeks, then those that land in none. The framework's items for the department follow the plan's
// in each, locked.
export function PlanList({
  items,
  framework,
  weeks,
  editable,
  busy,
  onEdit,
  onRemove,
}: {
  items: PlanItem[];
  framework: PlanItem[];
  weeks: number;
  editable: boolean;
  busy: boolean;
  onEdit: (item: PlanItem) => void;
  onRemove: (item: PlanItem) => void;
}) {
  const t = useTranslations("plan");
  const id = useId();
  const all = [
    ...items.map((item) => ({ item, locked: false })),
    ...framework.map((item) => ({ item, locked: true })),
  ];
  const recurs = (item: PlanItem) =>
    item.due.type === "weekly" || item.due.type === "everyWeeks";
  const groups = [
    {
      key: "recurring",
      title: t("list.recurring"),
      entries: all.filter(({ item }) => recurs(item)),
    },
    ...Array.from({ length: weeks }, (_, index) => index + 1).map((week) => ({
      key: `week-${week}`,
      title: t("list.week", { week }),
      entries: all.filter(
        ({ item }) => !recurs(item) && item.weeks.includes(week),
      ),
    })),
    {
      key: "outside",
      title: t("list.outside"),
      entries: all.filter(({ item }) => item.weeks.length === 0),
    },
  ].filter(({ entries }) => entries.length > 0);

  return (
    <div className="flex flex-col">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`${id}-${group.key}`}>
          <h3
            id={`${id}-${group.key}`}
            className="border-b bg-muted/40 px-5 py-2 font-medium text-xs"
          >
            {group.title}
          </h3>
          <ul className="divide-y border-b">
            {group.entries.map(({ item, locked }) => (
              <li
                key={item.id}
                className={cn(
                  "flex items-start justify-between gap-3 px-5 py-3",
                  locked && "text-muted-foreground",
                )}
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-medium text-sm">
                    {locked ? (
                      <Lock
                        aria-label={t("grid.locked")}
                        className="size-4 shrink-0"
                      />
                    ) : null}
                    {item.title}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {item.words.appliesTo} · {item.words.due}
                  </p>
                  {editable && !locked ? <PlanFlags item={item} /> : null}
                </div>
                {editable && !locked ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("edit", { title: item.title })}
                      onClick={() => onEdit(item)}
                    >
                      <Pencil aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("remove", { title: item.title })}
                      disabled={busy}
                      onClick={() => onRemove(item)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
