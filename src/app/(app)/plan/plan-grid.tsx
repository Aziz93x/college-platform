"use client";

import { Lock, Pencil, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { type KeyboardEvent, useState } from "react";
import { Checkbox } from "@/components/motion/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { PlanFlags } from "./plan-flags.tsx";
import { type Move, movable, type Period, type PlanItem } from "./plan-item.ts";

// The plan by weeks (Step 19): a row for each item and a column for each week of the term, with a
// mark in each week the item lands in, the exam periods' weeks tinted. On a draft, an item due in
// one week is moved by dragging its mark along its row, or with the arrow keys once its mark has
// focus; items are chosen with their boxes and moved or taken out together. The framework's items
// for the department follow, locked.
export function PlanGrid({
  items,
  framework,
  weeks,
  periods,
  editable,
  selected,
  busy,
  onSelect,
  onMove,
  onEdit,
  onRemove,
}: {
  items: PlanItem[];
  framework: PlanItem[];
  weeks: number;
  periods: Period[];
  editable: boolean;
  selected: ReadonlySet<string>;
  busy: boolean;
  onSelect: (ids: ReadonlySet<string>) => void;
  onMove: (moves: Move[], focus?: string) => void;
  onEdit: (item: PlanItem) => void;
  onRemove: (item: PlanItem) => void;
}) {
  const t = useTranslations("plan");
  const format = useFormatter();
  const [dragging, setDragging] = useState<string>();
  const [over, setOver] = useState<number>();
  const columns = Array.from({ length: weeks }, (_, index) => index + 1);
  const periodOf = (week: number) =>
    periods.find(({ from, to }) => week >= from && week <= to);

  // A mark's arrow keys follow the page's direction: in Arabic the next week is to the left.
  const keyed = (event: KeyboardEvent, item: PlanItem, week: number) => {
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const next =
      event.key === (rtl ? "ArrowLeft" : "ArrowRight")
        ? week + 1
        : event.key === (rtl ? "ArrowRight" : "ArrowLeft")
          ? week - 1
          : event.key === "Home"
            ? 1
            : event.key === "End"
              ? weeks
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    if (next < 1 || next > weeks || next === week || busy) return;
    onMove([{ itemId: item.id, week: next }], item.id);
  };

  const toggle = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    onSelect(next);
  };

  const row = (item: PlanItem, locked: boolean) => {
    const moves = editable && !locked && movable(item);
    return (
      <tr key={item.id} className={cn(locked && "text-muted-foreground")}>
        <th
          scope="row"
          className={cn(
            "sticky start-0 z-10 min-w-72 max-w-80 border-b bg-card px-3 py-2 text-start align-top font-normal",
            selected.has(item.id) && "bg-muted",
          )}
        >
          <div className="flex items-start gap-2">
            {locked ? (
              <Lock
                aria-label={t("grid.locked")}
                className="mt-0.5 size-4 shrink-0"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              {editable && !locked ? (
                <Checkbox
                  label={item.title}
                  description={`${item.words.appliesTo} · ${item.words.due}`}
                  checked={selected.has(item.id)}
                  onCheckedChange={(checked) => toggle(item.id, checked)}
                />
              ) : (
                <>
                  <p className="font-medium text-sm">{item.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {item.words.appliesTo} · {item.words.due}
                  </p>
                </>
              )}
              {editable && !locked ? (
                <div className="ps-8">
                  <PlanFlags item={item} />
                </div>
              ) : null}
            </div>
            {editable && !locked ? (
              <div className="-my-1 flex shrink-0 items-center">
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
          </div>
        </th>
        {columns.map((week) => {
          const due = item.weeks.includes(week);
          return (
            <td
              key={week}
              onDragOver={(event) => {
                if (dragging !== item.id) return;
                event.preventDefault();
                setOver(week);
              }}
              onDrop={(event) => {
                if (dragging !== item.id) return;
                event.preventDefault();
                setDragging(undefined);
                setOver(undefined);
                if (!due) onMove([{ itemId: item.id, week }], item.id);
              }}
              className={cn(
                "h-11 w-9 min-w-9 border-b border-s text-center",
                periodOf(week) && "bg-secondary/10",
                selected.has(item.id) && "bg-muted",
                dragging === item.id && over === week && "bg-primary/15",
              )}
            >
              {due ? (
                moves ? (
                  <button
                    type="button"
                    draggable
                    data-mark={item.id}
                    aria-label={t("grid.mark", { title: item.title, week })}
                    aria-keyshortcuts="ArrowLeft ArrowRight Home End"
                    onKeyDown={(event) => keyed(event, item, week)}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", item.id);
                      setDragging(item.id);
                    }}
                    onDragEnd={() => {
                      setDragging(undefined);
                      setOver(undefined);
                    }}
                    className="mx-auto block size-6 cursor-grab rounded-full bg-primary shadow-xs outline-none ring-ring/40 transition-transform hover:scale-110 focus-visible:ring-4 active:cursor-grabbing"
                  />
                ) : (
                  <span
                    aria-hidden
                    className={cn(
                      "mx-auto block size-3 rounded-full",
                      locked ? "bg-muted-foreground/60" : "bg-primary/70",
                    )}
                  />
                )
              ) : null}
            </td>
          );
        })}
      </tr>
    );
  };

  const choosable = editable ? items : [];
  const all =
    choosable.length > 0 && choosable.every(({ id }) => selected.has(id));

  return (
    // Focusable, so that a keyboard scrolls the weeks of a plan it cannot change.
    <section
      aria-label={t("grid.label")}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region is reached by keyboard
      tabIndex={0}
      className="overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
    >
      <table className="w-full border-separate border-spacing-0 text-sm">
        <caption className="sr-only">{t("grid.label")}</caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky start-0 z-10 border-b bg-card px-3 py-2 text-start font-medium text-muted-foreground text-xs"
            >
              <div className="flex items-center gap-2">
                {editable && choosable.length > 0 ? (
                  <Checkbox
                    label={t("grid.selectAll")}
                    checked={all}
                    onCheckedChange={(checked) =>
                      onSelect(
                        new Set(checked ? choosable.map(({ id }) => id) : []),
                      )
                    }
                  />
                ) : (
                  t("grid.item")
                )}
              </div>
            </th>
            {columns.map((week) => {
              const period = periodOf(week);
              return (
                <th
                  key={week}
                  scope="col"
                  title={period?.name}
                  className={cn(
                    "border-s border-b px-0 py-2 text-center font-medium text-muted-foreground text-xs tabular-nums",
                    period && "bg-secondary/10 text-foreground",
                  )}
                >
                  <span aria-hidden>{format.number(week)}</span>
                  <span className="sr-only">
                    {period
                      ? t("grid.periodWeek", { week, period: period.name })
                      : t("grid.week", { week })}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => row(item, false))}
          {framework.length > 0 ? (
            <tr>
              <th
                scope="colgroup"
                colSpan={weeks + 1}
                className="border-b bg-muted/40 px-3 py-2 text-start font-medium text-xs"
              >
                <span className="sticky start-3">{t("framework.title")}</span>
              </th>
            </tr>
          ) : null}
          {framework.map((item) => row(item, true))}
        </tbody>
      </table>
    </section>
  );
}
