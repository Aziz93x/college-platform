import type { ReactNode } from "react";
import { ToasterLayout } from "@/components/toaster-layout";

// A file checked, an upload applied or discarded, and a rollback are confirmed with a toast.
export default function RayatLayout({ children }: { children: ReactNode }) {
  return <ToasterLayout>{children}</ToasterLayout>;
}
