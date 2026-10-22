import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { requireViewer } from "@/modules/access";
import { SetupForm } from "../../../(auth)/two-factor/setup/setup-form.tsx";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("auth.twoFactorSetup");
  return { title: t("title") };
}

// Two-factor set up by choice, from the profile, inside the shell (ADR-0014): the form of the
// sign-in pages' setup, whose last step brings the person back to the profile. Whoever the college
// requires it of is sent to that setup before anything else instead (requireViewer).
export default async function ProfileTwoFactorPage() {
  await connection();
  const viewer = await requireViewer();
  if (viewer.twoFactorEnabled) redirect("/profile");
  const [t, profile, ui, { ui: uiWords, actions, auth }] = await Promise.all([
    getTranslations("auth.twoFactorSetup"),
    getTranslations("profile"),
    getTranslations("ui"),
    getMessages(),
  ]);
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("descriptionOptional")}
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
                twoFactorSetup: auth.twoFactorSetup,
                signIn: { locked: auth.signIn.locked },
              },
            }}
          >
            <SetupForm />
          </NextIntlClientProvider>
        </div>
      </section>
    </>
  );
}
