import type { ReactNode } from "react";
import { ToasterLayout } from "@/components/toaster-layout";

// A saved, moved or removed item and a publication are confirmed with a toast.
export default function PlanLayout({ children }: { children: ReactNode }) {
  return <ToasterLayout>{children}</ToasterLayout>;
}
