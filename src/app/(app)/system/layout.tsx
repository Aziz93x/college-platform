import type { ReactNode } from "react";
import { ToasterLayout } from "@/components/toaster-layout";

// The system page confirms a pass run again, and everyone signed out, with a toast.
export default function SystemLayout({ children }: { children: ReactNode }) {
  return <ToasterLayout>{children}</ToasterLayout>;
}
