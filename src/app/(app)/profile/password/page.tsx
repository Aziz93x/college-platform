import type { Metadata } from "next";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { requireViewer } from "@/modules/access";
import { getSetting } from "@/modules/settings";
import { PasswordForm } from "../../../(auth)/change-password/password-form.tsx";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("auth.changePassword");
  return { title: t("title") };
}

// A new password the person chooses, from the profile or the account menu, inside the shell: the
// form of the sign-in pages' forced change, which returns to the profile once the password changes.
export default async function ProfilePasswordPage() {
  await connection();
  const viewer = await requireViewer();
  const [t, profile, ui, minLength, { ui: uiWords, actions, auth }] =
    await Promise.all([
      getTranslations("auth.changePassword"),
      getTranslations("profile"),
      getTranslations("ui"),
      getSetting("auth.passwordMinLength", { collegeId: viewer.collegeId }),
      getMessages(),
    ]);
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: profile("title"), href: "/profile" }]}
        breadcrumbsLabel={ui("trail")}
      />
      <section className="rounded-xl border bg-card px-5 pb-5 shadow-xs sm:px-6">
        <div className="max-w-sm">
          <NextIntlClientProvider
            messages={{
              ui: uiWords,
              actions,
              auth: {
                changePassword: auth.changePassword,
                signIn: { locked: auth.signIn.locked },
              },
            }}
          >
            <PasswordForm
              minLength={minLength}
              done="/profile"
              cancelHref="/profile"
            />
          </NextIntlClientProvider>
        </div>
      </section>
    </>
  );
}
