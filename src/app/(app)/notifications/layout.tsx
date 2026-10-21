import type { ReactNode } from "react";
import { ToasterLayout } from "@/components/toaster-layout";

// The notification center and the preferences confirm what they did with a toast.
export default function NotificationsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <ToasterLayout>{children}</ToasterLayout>;
}
