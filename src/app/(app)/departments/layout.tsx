import type { ReactNode } from "react";
import { ToasterLayout } from "@/components/toaster-layout";

// The departments and the college's names confirm each save with a toast, which stays on show from
// the form back to the list.
export default function DepartmentsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <ToasterLayout>{children}</ToasterLayout>;
}
