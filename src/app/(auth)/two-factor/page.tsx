import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/modules/identity";
import { CodeForm } from "./code-form.tsx";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("auth.twoFactor");
  return { title: t("title") };
}

// Signing in, second step: after the password, a code from the authenticator app or a backup code.
// The step itself lives in a cookie Better Auth set with the password; without it, the form says
// to start again.
export default async function TwoFactorPage() {
  await connection();
  if (await getSessionUser()) redirect("/today");
  const t = await getTranslations("auth.twoFactor");
  return (
    <>
      <h2 className="text-xl">{t("title")}</h2>
      <CodeForm />
    </>
  );
}
