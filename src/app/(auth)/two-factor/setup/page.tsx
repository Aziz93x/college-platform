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

// Two-factor set up before anything else, for whoever the college requires it of (requireViewer
// sends them, ADR-0014). Anyone who chooses it sets it up from the profile, inside the shell
// (/profile/two-factor).
export default async function TwoFactorSetupPage() {
  await connection();
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  if (viewer.mustChangePassword) redirect("/change-password");
  if (!viewer.needsTwoFactorSetup) {
    // Set up already: where the setup's own action sends them, Today when the college requires it.
    // The browser fetches this page again after the action, and may follow this answer last, so
    // both must lead to the same place (lead review B).
    if (viewer.twoFactorEnabled) {
      redirect(viewer.twoFactorRequired ? "/today" : "/profile");
    }
    redirect("/profile/two-factor");
  }
  const t = await getTranslations("auth.twoFactorSetup");
  return (
    <>
      <h2 className="text-xl">{t("title")}</h2>
      <p className="mt-1 text-muted-foreground text-sm">{t("description")}</p>
      <SetupForm />
    </>
  );
}
