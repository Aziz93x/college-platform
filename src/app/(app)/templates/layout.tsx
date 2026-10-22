import type { ReactNode } from "react";
import { ToasterLayout } from "@/components/toaster-layout";

// A saved or removed template is confirmed with a toast.
export default function TemplatesLayout({ children }: { children: ReactNode }) {
  return <ToasterLayout>{children}</ToasterLayout>;
}
