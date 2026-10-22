"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/motion/combobox";
import {
  type DateRange,
  DateRangePickerDropdown,
} from "@/components/motion/date-range-picker";
import { Input } from "@/components/motion/input";
import { Button } from "@/components/ui/button";
import { useDateRangeWords } from "@/components/use-date-range-words";
import { firstDayOfWeek } from "@/platform/i18n/language";
import { auditHref } from "./href.ts";
import type { AuditQuery } from "./query.ts";

// The action list's first choice: every action.
const ANY = "any";

// The log's filters: a period of days up to today on the college's clock, one action, and a person
// by name, employee number or email. "Show" puts them in the address, which the page reads.
export function AuditFilters({
  query,
  actions,
  today,
}: {
  query: Omit<AuditQuery, "after">;
  actions: { value: string; label: string; group: string }[];
  today: string;
}) {
  const t = useTranslations("audit.filters");
  const words = useDateRangeWords(t("period"));
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [range, setRange] = useState<DateRange | null>(
    query.from ? { from: query.from, to: query.to } : null,
  );
  const [action, setAction] = useState<string>(query.action ?? ANY);
  const [search, setSearch] = useState(query.q ?? "");
  const filtered = Boolean(query.from || query.action || query.q);

  return (
    <form
      aria-label={t("label")}
      onSubmit={(event) => {
        event.preventDefault();
        const href = auditHref("/audit", {
          from: range?.from,
          to: range?.to,
          action: action === ANY ? undefined : (action as AuditQuery["action"]),
          q: search.trim() || undefined,
        });
        startTransition(() => router.push(href));
      }}
      // Two columns on a phone, so the first events show above the fold; one row from a laptop up.
      className="mb-6 grid grid-cols-2 gap-x-3 gap-y-4 rounded-xl border bg-card p-4 shadow-xs sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto] lg:items-end"
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        {/* The trigger's name carries the label with the chosen period. */}
        <span aria-hidden className="px-1 font-medium text-sm">
          {t("period")}
        </span>
        <DateRangePickerDropdown
          value={range}
          onValueChange={setRange}
          words={words}
          locale={locale}
          weekStartsOn={firstDayOfWeek(locale)}
          max={today}
          today={today}
          className="w-full"
        />
      </div>
      <Combobox
        // Every action shows as the field's placeholder, as an unchosen period does.
        value={action === ANY ? undefined : action}
        onValueChange={setAction}
        className="min-w-0"
      >
        <ComboboxLabel>{t("action")}</ComboboxLabel>
        <ComboboxTrigger>
          <ComboboxInput placeholder={t("anyAction")} />
        </ComboboxTrigger>
        <ComboboxContent>
          <ComboboxList aria-label={t("actions")}>
            <ComboboxItem value={ANY} textValue={t("anyAction")}>
              {t("anyAction")}
            </ComboboxItem>
            {actions.map((each) => (
              <ComboboxItem
                key={each.value}
                value={each.value}
                textValue={each.label}
                keywords={[each.group]}
              >
                <span className="block">{each.label}</span>
                <span className="block text-muted-foreground text-xs">
                  {each.group}
                </span>
              </ComboboxItem>
            ))}
          </ComboboxList>
          <ComboboxEmpty>{t("noAction")}</ComboboxEmpty>
        </ComboboxContent>
      </Combobox>
      <Input
        label={t("search")}
        type="search"
        value={search}
        onChange={setSearch}
        placeholder={t("searchPlaceholder")}
        startIcon={<Search />}
        enterKeyHint="search"
        autoComplete="off"
        className="col-span-2 min-w-0 lg:col-span-1"
      />
      <div className="col-span-2 flex items-center gap-2 lg:col-span-1">
        <Button
          type="submit"
          disabled={pending}
          className="h-11 flex-1 px-5 lg:flex-none"
        >
          {t("apply")}
        </Button>
        {filtered ? (
          <Button asChild variant="ghost" className="h-11">
            <Link href="/audit">{t("clear")}</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
