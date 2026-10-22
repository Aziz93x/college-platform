import type { ReactNode } from "react";
import { ToasterLayout } from "@/components/toaster-layout";

// A publication says how many it reached, and a withdrawal that it is done, each in a toast.
export default function AnnouncementsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <ToasterLayout>{children}</ToasterLayout>;
}
