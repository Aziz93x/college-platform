import Image from "next/image";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { IdentityArt } from "@/components/identity-art";
import { TextReveal } from "@/components/motion/text-reveal";
import { findCollege } from "@/modules/org";
import { getSetting } from "@/modules/settings";

// The pages before the platform: signing in, its second step, setting up two-factor and replacing
// a password. One column on a phone, the identity's dark panel beside the form on a wide screen
// (docs/PLAN.md section 4). The names come from settings and the college; the logo shows only once
// the dean has approved it (login.showLogo).
export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  // The names live in the database, which next build does not reach.
  await connection();
  const college = await findCollege();
  const scope = college ? { collegeId: college.id } : undefined;
  const [platformName, showLogo, t, { ui, auth, actions }] = await Promise.all([
    scope ? getSetting("platform.name", scope) : null,
    scope ? getSetting("login.showLogo", scope) : false,
    getTranslations("platform"),
    getMessages(),
  ]);

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <header className="dark relative isolate flex min-h-64 flex-col justify-end overflow-hidden bg-background px-6 pt-10 pb-24 text-foreground lg:sticky lg:top-0 lg:h-dvh lg:w-[46%] lg:px-14 lg:pb-40">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(90%_70%_at_50%_110%,color-mix(in_srgb,var(--gradient-end)_42%,transparent),transparent_72%)]"
        />
        <IdentityArt
          element="dots"
          sizes="(min-width: 1024px) 480px, 320px"
          eager
          className="absolute -top-16 end-0 -z-10 h-auto w-80 max-w-none opacity-15 lg:w-[30rem]"
        />
        {/* The wave's teal lines, brightened by the screen blend so they read on the dark panel. */}
        <IdentityArt
          element="wave"
          sizes="(min-width: 1024px) 64vw, 120vw"
          eager
          className="fade-in absolute -end-[10%] bottom-6 -z-10 h-auto w-[120%] max-w-none animate-in opacity-70 mix-blend-screen brightness-250 duration-1000 lg:bottom-12 lg:w-[140%] rtl:-scale-x-100"
        />
        {showLogo ? (
          <Image
            src="/brand/logo-horizontal-white.svg"
            alt={college?.name ?? ""}
            width={240}
            height={64}
            unoptimized
            className="mb-8 h-12 w-auto self-start lg:h-14"
          />
        ) : null}
        <TextReveal
          as="h1"
          text={platformName ?? t("name")}
          className="max-w-md text-balance text-2xl lg:text-3xl"
        />
        {college ? (
          <TextReveal
            as="p"
            text={college.name}
            delayMs={240}
            className="mt-2 text-foreground/80 lg:text-lg"
          />
        ) : null}
        <span
          aria-hidden
          className="mt-5 block h-1 w-10 rounded-full from-gradient-end to-primary ltr:bg-linear-to-r rtl:bg-linear-to-l"
        />
      </header>
      <main className="flex flex-1 justify-center px-4 pb-12 lg:items-center lg:px-10 lg:py-12">
        <div className="relative -mt-8 h-fit w-full max-w-sm rounded-xl border bg-card px-5 py-7 shadow-lg sm:px-7 lg:mt-0 lg:border-0 lg:p-0 lg:shadow-none">
          {/* The forms read their words on the client; other routes never receive them. */}
          <NextIntlClientProvider messages={{ ui, auth, actions }}>
            {children}
          </NextIntlClientProvider>
        </div>
      </main>
    </div>
  );
}
