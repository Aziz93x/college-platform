import type { ReactNode } from "react";
import { ToasterLayout } from "@/components/toaster-layout";

// An assignment made or revoked, and a template or its item saved or taken out, are confirmed with
// a toast.
export default function AssignmentsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <ToasterLayout>{children}</ToasterLayout>;
}
