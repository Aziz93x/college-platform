"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import * as m from "motion/react-m";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { SPRING_LAYOUT } from "@/components/motion/lib/ease";
import { SaveActions, useSaveState } from "@/components/save-actions";
import type { navigation } from "../../_shell/navigation.ts";
import { savePageOrderAction } from "../actions.ts";

type Page = { id: (typeof navigation)[number]["id"]; label: string };

// The order of the role's pages in the sidebar and the phone's tab bar: each page moves up or down
// a place, and the order is saved for the role. A line marks where a phone's tabs end and its
// "More" begins (UX review 2).
export function PageOrder({
  roleId,
  pages,
  tabs,
}: {
  roleId: string;
  /** The pages the role opens, in its current order. */
  pages: Page[];
  /** How many of them a phone shows as tabs; the rest are under "More". */
  tabs: number;
}) {
  const t = useTranslations("roles.order");
  const refusals = useTranslations("actions");
  const id = useId();
  const [order, setOrder] = useState(pages);
  const [refusal, setRefusal] = useState<string>();
  const [state, setState] = useSaveState();
  const [, startTransition] = useTransition();
  const dirty = order.some((page, index) => page.id !== pages[index]?.id);

  const move = (index: number, by: -1 | 1) => {
    setOrder((current) => {
      const next = [...current];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });
    setRefusal(undefined);
    setState("idle");
  };

  const save = () =>
    startTransition(async () => {
      setState("saving");
      const result = await savePageOrderAction({
        roleId,
        order: order.map((page) => page.id),
      });
      const status = result?.data?.status;
      if (status === "saved" || status === "unchanged") {
        setState("saved");
        toast.success(t("toast"));
        return;
      }
      setState("idle");
      setRefusal(refusals(result?.serverError ?? "unexpected"));
    });

  const arrow =
    "grid size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-30";

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="rounded-xl border bg-card shadow-xs"
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (dirty) save();
        }}
        className="flex flex-col gap-4 px-5 py-5 sm:px-6"
      >
        <div>
          <h2 id={`${id}-title`} className="font-medium text-base">
            {t("title")}
          </h2>
          <p className="mt-1 max-w-prose text-pretty text-muted-foreground text-sm">
            {t("description")}
            {tabs < order.length ? ` ${t("phone", { count: tabs })}` : null}
          </p>
        </div>
        <ol aria-label={t("list")} className="flex flex-col gap-1 sm:max-w-md">
          {order.map((page, index) => [
            index === tabs ? (
              <li
                key="more"
                aria-hidden
                className="flex items-center gap-2 py-1 text-muted-foreground text-xs"
              >
                <span className="h-px flex-1 bg-border" />
                {t("more")}
                <span className="h-px flex-1 bg-border" />
              </li>
            ) : null,
            <m.li
              key={page.id}
              layout="position"
              transition={SPRING_LAYOUT}
              className="flex items-center gap-2 rounded-lg border bg-background ps-3"
            >
              <span className="w-5 text-muted-foreground text-sm tabular-nums">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">
                {page.label}
              </span>
              <button
                type="button"
                aria-label={t("up", { page: page.label })}
                disabled={index === 0}
                onClick={() => move(index, -1)}
                className={arrow}
              >
                <ArrowUp aria-hidden className="size-4" />
              </button>
              <button
                type="button"
                aria-label={t("down", { page: page.label })}
                disabled={index === order.length - 1}
                onClick={() => move(index, 1)}
                className={arrow}
              >
                <ArrowDown aria-hidden className="size-4" />
              </button>
            </m.li>,
          ])}
        </ol>
        {refusal ? (
          <p role="alert" className="text-alert text-sm">
            {refusal}
          </p>
        ) : null}
        <SaveActions
          dirty={dirty}
          state={state}
          onDiscard={() => {
            setOrder(pages);
            setRefusal(undefined);
          }}
          words={{ save: t("save"), saving: t("saving") }}
        />
      </form>
    </section>
  );
}
