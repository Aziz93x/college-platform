import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { getViewer } from "@/modules/access";
import { SetupForm } from "./setup-form.tsx";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("auth.twoFactorSetup");
  return { title: t("title") };
}

// Two-factor set up: before anything else for whoever the college requires it of (requireViewer
// sends them), and from the profile for anyone who chooses it (ADR-0014).
export default async function TwoFactorSetupPage() {
  await connection();
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  if (viewer.mustChangePassword) redirect("/change-password");
  if (viewer.twoFactorEnabled) redirect("/profile");
  const required = viewer.needsTwoFactorSetup;
  const t = await getTranslations("auth.twoFactorSetup");
  return (
    <>
      <h2 className="text-xl">{t("title")}</h2>
      <p className="mt-1 text-muted-foreground text-sm">
        {required ? t("description") : t("descriptionOptional")}
      </p>
      <SetupForm />
      {required ? null : (
        <Button asChild variant="ghost" className="mt-4 h-11 w-full">
          <Link href="/profile">{t("back")}</Link>
        </Button>
      )}
    </>
  );
}
