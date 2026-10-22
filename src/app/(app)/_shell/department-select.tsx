"use client";

import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";

// The department a page shows, chosen by a viewer who reaches more than one (ADR-0021). It lives in
// the address (?department=), which the page reads; choosing another leaves the page's other
// filters behind, and onChange lets the page clear its own.
export function DepartmentSelect({
  label,
  path,
  departments,
  department,
  onChange,
}: {
  label: string;
  path: string;
  departments: { id: string; name: string }[];
  department: string;
  onChange?: () => void;
}) {
  const id = useId();
  const router = useRouter();
  const [, startTransition] = useTransition();
  return (
    <div className="flex min-w-0 flex-col gap-1.5 sm:w-64">
      <span id={id} className="px-1 font-medium text-sm">
        {label}
      </span>
      <Select
        aria-labelledby={id}
        value={department}
        onValueChange={(value) => {
          onChange?.();
          startTransition(() =>
            router.push(
              `${path}?${new URLSearchParams({ department: value })}`,
            ),
          );
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
  );
}
