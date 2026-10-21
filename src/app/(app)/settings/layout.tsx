import type { ReactNode } from "react";
import { ToasterLayout } from "@/components/toaster-layout";

// The settings screen confirms each save and reset with a toast.
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <ToasterLayout>{children}</ToasterLayout>;
}
