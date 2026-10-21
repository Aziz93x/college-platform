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

// A new password: required after a temporary one (requireViewer sends the person here first), and
// open to anyone signed in from the account menu.
export default async function ChangePasswordPage() {
  await connection();
  const user = await getSessionUser();
  if (!user) redirect("/");
  const [minLength, t] = await Promise.all([
    getSetting("auth.passwordMinLength", { collegeId: user.collegeId }),
    getTranslations("auth.changePassword"),
  ]);
  return (
    <>
      <h2 className="text-xl">{t("title")}</h2>
      <p className="mt-1 text-muted-foreground text-sm">
        {user.mustChangePassword ? t("required") : t("description")}
      </p>
      <PasswordForm
        minLength={minLength}
        canCancel={!user.mustChangePassword}
      />
    </>
  );
}
