import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/modules/identity";
import { findCollegeId } from "@/modules/org";
import { getSetting, settingsRegistry } from "@/modules/settings";
import { SignInForm } from "./sign-in-form.tsx";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("auth.signIn");
  return { title: t("title") };
}

// The platform's address: the sign-in form, or the platform itself for someone signed in.
export default async function SignInPage() {
  await connection();
  if (await getSessionUser()) redirect("/today");
  const collegeId = await findCollegeId();
  const [rememberDays, t] = await Promise.all([
    collegeId
      ? getSetting("auth.rememberedDeviceDays", { collegeId })
      : settingsRegistry["auth.rememberedDeviceDays"].default,
    getTranslations("auth.signIn"),
  ]);
  return (
    <>
      <h2 className="text-xl">{t("title")}</h2>
      <p className="mt-1 text-muted-foreground text-sm">{t("description")}</p>
      <SignInForm rememberDays={rememberDays} />
      <p className="mt-6 border-t pt-5 text-muted-foreground text-sm">
        {t("help")}
      </p>
    </>
  );
}
