import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/modules/identity";
import { getSetting } from "@/modules/settings";
import { PasswordForm } from "./password-form.tsx";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("auth.changePassword");
  return { title: t("title") };
}

// A new password after a temporary one, before anything else (requireViewer sends the person here).
// A change the person chooses is the profile's, inside the shell (/profile/password).
export default async function ChangePasswordPage() {
  await connection();
  const user = await getSessionUser();
  if (!user) redirect("/");
  if (!user.mustChangePassword) redirect("/profile/password");
  const [minLength, t] = await Promise.all([
    getSetting("auth.passwordMinLength", { collegeId: user.collegeId }),
    getTranslations("auth.changePassword"),
  ]);
  return (
    <>
      <h2 className="text-xl">{t("title")}</h2>
      <p className="mt-1 text-muted-foreground text-sm">{t("required")}</p>
      <PasswordForm minLength={minLength} done="/today" />
    </>
  );
}
