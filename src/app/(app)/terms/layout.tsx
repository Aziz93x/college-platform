import type { ReactNode } from "react";
import { ToasterLayout } from "@/components/toaster-layout";

// The terms confirm each change with a toast, which stays on show from the form to the term's page.
export default function TermsLayout({ children }: { children: ReactNode }) {
  return <ToasterLayout>{children}</ToasterLayout>;
}
