import type { ReactNode } from "react";
import { ToasterLayout } from "@/components/toaster-layout";

// A request sent is confirmed with a toast that says how many people it reached.
export default function RequestsLayout({ children }: { children: ReactNode }) {
  return <ToasterLayout>{children}</ToasterLayout>;
}
