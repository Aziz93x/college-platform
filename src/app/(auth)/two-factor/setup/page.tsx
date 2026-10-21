import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { getViewer } from "@/modules/access";
import { SetupForm } from "./setup-form.tsx";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("auth.twoFactorSetup");
  return { title: t("title") };
}

// Whoever holds a permission that requires two-factor sets it up here before anything else
// (requireViewer sends them); everyone else has nothing to do here.
export default async function TwoFactorSetupPage() {
  await connection();
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  if (viewer.mustChangePassword) redirect("/change-password");
  if (!viewer.needsTwoFactorSetup) redirect("/today");
  const t = await getTranslations("auth.twoFactorSetup");
  return (
    <>
      <h2 className="text-xl">{t("title")}</h2>
      <p className="mt-1 text-muted-foreground text-sm">{t("description")}</p>
      <SetupForm />
    </>
  );
}
