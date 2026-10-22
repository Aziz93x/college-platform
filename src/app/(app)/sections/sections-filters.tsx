"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import { NoResults, SearchField } from "@/components/search-field";

// How long the search waits after the last key before it asks the page again.
const SEARCH_DELAY = 300;

function sectionsHref(department: string | undefined, q: string) {
  const params = new URLSearchParams();
  if (department) params.set("department", department);
  if (q.trim()) params.set("q", q.trim());
  return params.size > 0 ? `/sections?${params}` : "/sections";
}

// The sections page's department, chosen by a viewer who reaches more than one, and its search by
// reference, course or trainer. Both live in the address, which the page reads (ADR-0021).
export function SectionsFilters({
  departments,
  department,
  query,
  results,
}: {
  /** The departments the viewer may choose from; none when they reach one. */
  departments: { id: string; name: string }[];
  department: string;
  query: string;
  /** How many sections the search found. */
  results: number;
}) {
  const t = useTranslations("sections.filters");
  const id = useId();
  const router = useRouter();
  const [search, setSearch] = useState(query);
  const [, startTransition] = useTransition();
  const chosen = departments.length > 0 ? department : undefined;

  useEffect(() => {
    if (search.trim() === query.trim()) return;
    const timer = setTimeout(
      () => startTransition(() => router.replace(sectionsHref(chosen, search))),
      SEARCH_DELAY,
    );
    return () => clearTimeout(timer);
  }, [search, query, chosen, router]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {departments.length > 0 ? (
          <div className="flex min-w-0 flex-col gap-1.5 sm:w-64">
            <span id={`${id}-department`} className="px-1 font-medium text-sm">
              {t("department")}
            </span>
            <Select
              aria-labelledby={`${id}-department`}
              value={department}
              onValueChange={(value) => {
                setSearch("");
                startTransition(() => router.push(sectionsHref(value, "")));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {departments.map((each) => (
                  <SelectItem key={each.id} value={each.id}>
                    {each.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="min-w-0 flex-1 sm:max-w-sm">
          <SearchField
            label={t("search")}
            placeholder={t("placeholder")}
            value={search}
            onChange={setSearch}
            results={results}
          />
        </div>
      </div>
      {query.trim() && results === 0 ? (
        <NoResults query={query} onClear={() => setSearch("")} />
      ) : null}
    </div>
  );
}
