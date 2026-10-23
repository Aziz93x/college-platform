"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Input } from "@/components/motion/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

// The search over a page's list, alike on every page: its name for screen readers only, a button
// and Escape that clear it, and how many results it found, announced as it changes. The caller
// matches what is typed, Arabic-Indic digits read as Latin (toLatinDigits).
export function SearchField({
  label,
  placeholder,
  value,
  onChange,
  results,
  className,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  /** How many results the search found; nothing is announced while the field is empty. */
  results: number;
  className?: string;
}) {
  const t = useTranslations("ui.search");
  const searching = value.trim() !== "";
  return (
    <>
      <Input
        type="search"
        label={label}
        hideLabel
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={(event) => {
          if (event.key === "Escape") onChange("");
        }}
        startIcon={<Search />}
        endSlot={
          searching ? (
            <button
              type="button"
              aria-label={t("clear")}
              onClick={() => onChange("")}
            >
              <X aria-hidden />
            </button>
          ) : undefined
        }
        className={cn("w-full", className)}
      />
      <p aria-live="polite" className="sr-only">
        {searching ? t("results", { count: results }) : ""}
      </p>
    </>
  );
}

// What a search or the filters of a list show when nothing matches: the words it looked for, or
// the filters' own, and a way to clear it. The identity art is kept for a list with nothing in it
// yet (EmptyState).
export function NoResults(
  props:
    | { query: string; onClear: () => void }
    /** A list narrowed by filters: what none matched, and the link or button that clears them. */
    | { said: string; clear: ReactNode },
) {
  const t = useTranslations("ui.search");
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card px-6 py-8 text-center">
      <p className="text-sm">
        {"said" in props
          ? props.said
          : t("none", { query: props.query.trim() })}
      </p>
      {"clear" in props ? (
        props.clear
      ) : (
        <Button type="button" variant="outline" onClick={props.onClear}>
          {t("clear")}
        </Button>
      )}
    </div>
  );
}
