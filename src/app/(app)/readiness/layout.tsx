import type { ReactNode } from "react";
import { ToasterLayout } from "@/components/toaster-layout";

// The board confirms a reminder sent to a row's owners with a toast.
export default function ReadinessLayout({ children }: { children: ReactNode }) {
  return <ToasterLayout>{children}</ToasterLayout>;
}
