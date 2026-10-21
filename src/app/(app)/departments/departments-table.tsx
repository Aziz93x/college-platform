"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import { Table, type TableColumn } from "@/components/motion/table";
import type { Department } from "@/modules/org";

// The college's departments, each opening its form. How Rayat writes them is left off a phone,
// where the name and the state fill the width.
export function DepartmentsTable({
  departments,
}: {
  departments: Department[];
}) {
  const t = useTranslations("departments");
  const columns: TableColumn<Department>[] = [
    {
      key: "name",
      header: t("table.name"),
      sortable: true,
      cell: (department) => (
        <Link
          href={`/departments/${department.id}`}
          className="-my-1 flex min-h-11 flex-col justify-center rounded-md outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="font-medium">{department.name}</span>
          <span className="text-muted-foreground text-xs">
            {department.shortName}
          </span>
        </Link>
      ),
    },
    {
      key: "rayatValues",
      header: t("table.rayatValues"),
      className: "max-md:hidden",
      cell: (department) => (
        <ul className="flex flex-wrap gap-1.5">
          {department.rayatValues.map((value) => (
            <li
              key={value}
              className="rounded-full bg-muted px-2.5 py-0.5 text-xs"
            >
              {value}
            </li>
          ))}
        </ul>
      ),
    },
    {
      key: "active",
      header: t("table.status"),
      sortable: true,
      align: "end",
      sortValue: (department) => (department.active ? 0 : 1),
      cell: (department) => (
        <AnimatedBadge status={department.active ? "success" : "neutral"}>
          {department.active ? t("status.active") : t("status.inactive")}
        </AnimatedBadge>
      ),
    },
  ];
  return (
    <Table
      data={departments}
      columns={columns}
      getRowId={(department) => department.id}
      caption={t("table.caption")}
      emptyState={t("empty.title")}
    />
  );
}
