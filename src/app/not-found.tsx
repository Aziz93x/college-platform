import Link from "next/link";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { StatusPage } from "@/components/status-page";
import { Button } from "@/components/ui/button";

// Every address that matches no page, and a refused /design (src/proxy.ts). Its words follow the
// college's language setting, which lives in the database: without connection() first, next build
// would read it while prerendering.
export default async function NotFound() {
  await connection();
  const t = await getTranslations("pages");
  return (
    <main className="flex flex-1 flex-col">
      <StatusPage
        code={t("notFound.code")}
        title={t("notFound.title")}
        description={t("notFound.description")}
        action={
          <Button asChild>
            <Link href="/">{t("home")}</Link>
          </Button>
        }
      />
    </main>
  );
}
