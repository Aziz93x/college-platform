import Link from "next/link";
import { useTranslations } from "next-intl";
import { StatusPage } from "@/components/status-page";
import { Button } from "@/components/ui/button";

// Shown inside the shell when a page calls forbidden() (next.config.ts, authInterrupts).
export default function Forbidden() {
  const t = useTranslations("pages");
  return (
    <StatusPage
      code={t("forbidden.code")}
      title={t("forbidden.title")}
      description={t("forbidden.description")}
      action={
        <Button asChild>
          <Link href="/">{t("home")}</Link>
        </Button>
      }
    />
  );
}
