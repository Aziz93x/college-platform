import type { ReactNode } from "react";
import { ToasterLayout } from "@/components/toaster-layout";

// The texts page confirms each text saved and put back with a toast.
export default function TextsLayout({ children }: { children: ReactNode }) {
  return <ToasterLayout>{children}</ToasterLayout>;
}
