import type { ReactNode } from "react";
import { ToasterLayout } from "@/components/toaster-layout";

// A transfer made, kept or cancelled is confirmed with a toast.
export default function SectionsLayout({ children }: { children: ReactNode }) {
  return <ToasterLayout>{children}</ToasterLayout>;
}
