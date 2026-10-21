"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Table, type TableColumn } from "@/components/motion/table";

type RoleRow = {
  id: string;
  label: string;
  system: boolean;
  members: number;
  permissions: number;
};

// The college's roles, each opening its page: its keys, its members and its page order.
export function RolesTable({ roles }: { roles: RoleRow[] }) {
  const t = useTranslations("roles");
  const columns: TableColumn<RoleRow>[] = [
    {
      key: "label",
      header: t("table.role"),
      sortable: true,
      cell: (role) => (
        <Link
          href={`/roles/${role.id}`}
          className="-my-1 flex min-h-11 flex-col justify-center rounded-md font-medium outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
        >
          {role.label}
          {role.system ? (
            <span className="font-normal text-muted-foreground text-xs">
              {t("system")}
            </span>
          ) : null}
        </Link>
      ),
    },
    {
      key: "members",
      header: t("table.members"),
      sortable: true,
      cell: (role) => t("count.members", { count: role.members }),
    },
    {
      key: "permissions",
      header: t("table.permissions"),
      sortable: true,
      className: "max-sm:hidden",
      cell: (role) =>
        role.system
          ? t("all")
          : t("count.permissions", { count: role.permissions }),
    },
  ];
  return (
    <Table
      data={roles}
      columns={columns}
      getRowId={(role) => role.id}
      caption={t("table.caption")}
      // Never shown: the system role is always there.
      emptyState={null}
    />
  );
}
