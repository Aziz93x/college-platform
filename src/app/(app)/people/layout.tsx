import type { ReactNode } from "react";
import { ToasterLayout } from "@/components/toaster-layout";

// The people pages confirm each change with a toast, which stays on show from a form to the next page.
export default function PeopleLayout({ children }: { children: ReactNode }) {
  return <ToasterLayout>{children}</ToasterLayout>;
}
