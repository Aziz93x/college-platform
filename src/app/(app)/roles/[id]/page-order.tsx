"use client";

import { ArrowDown, ArrowUp, Check, LoaderCircle, Save } from "lucide-react";
import * as m from "motion/react-m";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { SPRING_LAYOUT } from "@/components/motion/lib/ease";
import type { navigation } from "../../_shell/navigation.ts";
import { savePageOrderAction } from "../actions.ts";

type Page = { id: (typeof navigation)[number]["id"]; label: string };

// The order of the role's pages in the sidebar and the phone's tab bar: each page moves up or down
// a place, and the order is saved for the role.
export function PageOrder({
  roleId,
  pages,
}: {
  roleId: string;
  /** The pages the role opens, in its current order. */
  pages: Page[];
}) {
  const t = useTranslations("roles.order");
  const refusals = useTranslations("actions");
  const id = useId();
  const [order, setOrder] = useState(pages);
  const [refusal, setRefusal] = useState<string>();
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [, startTransition] = useTransition();
  const dirty = order.some((page, index) => page.id !== pages[index]?.id);

  useEffect(() => {
    if (state !== "done") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);

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
      setState("running");
      const result = await savePageOrderAction({
        roleId,
        order: order.map((page) => page.id),
      });
      const status = result?.data?.status;
      if (status === "saved" || status === "unchanged") {
        setState("done");
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
          </p>
        </div>
        <ol aria-label={t("list")} className="flex flex-col gap-1 sm:max-w-md">
          {order.map((page, index) => (
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
            </m.li>
          ))}
        </ol>
        {refusal ? (
          <p role="alert" className="text-alert text-sm">
            {refusal}
          </p>
        ) : null}
        {dirty || state !== "idle" ? (
          <div className="flex justify-end">
            <ActionSwapButton
              type="submit"
              disabled={state === "running"}
              value={{ idle: "save", running: "saving", done: "saved" }[state]}
              items={[
                { id: "save", label: t("save"), icon: <Save /> },
                {
                  id: "saving",
                  label: t("saving"),
                  icon: <LoaderCircle className="animate-spin" />,
                },
                { id: "saved", label: t("saved"), icon: <Check /> },
              ]}
            />
          </div>
        ) : null}
      </form>
    </section>
  );
}
