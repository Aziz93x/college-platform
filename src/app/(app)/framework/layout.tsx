import type { ReactNode } from "react";
import { ToasterLayout } from "@/components/toaster-layout";

// A saved item, a publication and an endorsement are confirmed with a toast.
export default function FrameworkLayout({ children }: { children: ReactNode }) {
  return <ToasterLayout>{children}</ToasterLayout>;
}
