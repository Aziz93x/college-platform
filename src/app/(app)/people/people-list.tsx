"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import { searchCommands } from "@/components/motion/lib/command-search";
import { Table, type TableColumn } from "@/components/motion/table";
import { NoResults, SearchField } from "@/components/search-field";
import { toLatinDigits } from "@/platform/validation/digits";
import { AccountActions } from "./account-actions.tsx";
import { STATE_BADGE } from "./state-badge.ts";
import type { PersonView } from "./view.ts";

// The people the viewer reaches, to find by name, employee number or email, each opening their page.
// The email is left off a phone; the account's actions stay at the row's end.
export function PeopleList({ people }: { people: PersonView[] }) {
  const t = useTranslations("people");
  const [query, setQuery] = useState("");
  const shown = query.trim()
    ? searchCommands(
        people.map((person) => ({
          person,
          label: person.name,
          keywords: [person.employeeNumber, person.email],
        })),
        toLatinDigits(query),
      ).map(({ person }) => person)
    : people;
  const columns: TableColumn<PersonView>[] = [
    {
      key: "name",
      header: t("table.name"),
      sortable: true,
      cell: (person) => (
        <Link
          href={`/people/${person.userId}`}
          className="-my-1 flex min-h-11 flex-col justify-center rounded-md outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="font-medium">{person.name}</span>
          <span className="text-muted-foreground text-xs">
            {person.employeeNumber}
          </span>
        </Link>
      ),
    },
    {
      key: "email",
      header: t("table.email"),
      className: "max-lg:hidden",
      cell: (person) => <bdi className="text-sm">{person.email}</bdi>,
    },
    {
      key: "roles",
      header: t("table.roles"),
      className: "max-md:hidden",
      cell: (person) =>
        person.roles.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {person.roles.map((role) => (
              <li
                key={role.id}
                className="rounded-full bg-muted px-2.5 py-0.5 text-xs"
              >
                {role.label}
                <span aria-hidden> · </span>
                {role.place ?? t("college")}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-muted-foreground text-sm">{t("noRole")}</span>
        ),
    },
    {
      key: "state",
      header: t("table.state"),
      sortable: true,
      sortValue: (person) => Object.keys(STATE_BADGE).indexOf(person.state),
      cell: (person) => (
        <AnimatedBadge status={STATE_BADGE[person.state]}>
          {t(`states.${person.state}`)}
        </AnimatedBadge>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("table.actions")}</span>,
      align: "end",
      cell: (person) => (
        <div className="relative flex h-14 min-w-14 justify-end">
          <div className="absolute end-0 top-0 z-10">
            <AccountActions person={person} />
          </div>
        </div>
      ),
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <SearchField
        label={t("search.label")}
        placeholder={t("search.placeholder")}
        value={query}
        onChange={setQuery}
        results={shown.length}
        className="sm:max-w-sm"
      />
      {shown.length > 0 ? (
        <Table
          data={shown}
          columns={columns}
          getRowId={(person) => person.userId}
          caption={t("table.caption")}
        />
      ) : (
        <NoResults query={query} onClear={() => setQuery("")} />
      )}
    </div>
  );
}
