import type { ReactNode } from "react";
import { ToasterLayout } from "@/components/toaster-layout";

// A corrected axis is confirmed with a toast.
export default function AxesLayout({ children }: { children: ReactNode }) {
  return <ToasterLayout>{children}</ToasterLayout>;
}
