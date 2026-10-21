import type { ReactNode } from "react";
import { ToasterLayout } from "@/components/toaster-layout";

// The profile confirms turning two-factor off with a toast.
export default function ProfileLayout({ children }: { children: ReactNode }) {
  return <ToasterLayout>{children}</ToasterLayout>;
}
