import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { parseEnv } from "@/platform/config/env";
import { paletteTokens, roleTokens } from "@/styles/token-names";
import { isDesignCatalogEnabled } from "./gate";
import { Overlays } from "./overlays";
import { Primitives } from "./primitives";

// Literal class names, so Tailwind generates each one.
const TYPE_SIZES = [
  "text-3xl",
  "text-2xl",
  "text-xl",
  "text-lg",
  "text-base",
  "text-sm",
  "text-xs",
];
const SPACING = [
  ["1", "w-1"],
  ["2", "w-2"],
  ["3", "w-3"],
  ["4", "w-4"],
  ["6", "w-6"],
  ["8", "w-8"],
  ["12", "w-12"],
  ["16", "w-16"],
];
const RADII = [
  "rounded-xs",
  "rounded-sm",
  "rounded-md",
  "rounded-lg",
  "rounded-xl",
  "rounded-full",
];
const SHADOWS = ["shadow-xs", "shadow-sm", "shadow-md", "shadow-lg"];
// The motion tokens; a sample with no duration class runs the default transition duration.
const MOTION = [
  ["--duration-fast", "duration-(--duration-fast)"],
  ["--default-transition-duration", ""],
  ["--duration-slow", "duration-(--duration-slow)"],
];
// Fetched by pnpm identity:sync. The college logo never shows here: the page is reachable before
// sign-in, and the logo stays off there until the dean approves it.
const ELEMENTS = [
  ["wave", "/brand/element-wave.png"],
  ["dotGrid", "/brand/element-dot-grid.png"],
  ["curves", "/brand/element-curves.png"],
] as const;

// The messages follow the college's language setting, which lives in the database: without
// connection() first, next build would read it while prerendering.
export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("design");
  return { title: t("title") };
}

// The token and component catalog: on a laptop only, until Step 6 can restrict it to admins.
// The catalog never renders where the gate refuses it; src/proxy.ts gives that refusal its 404
// status, which a refusal from here, after loading.tsx has streamed, could not.
export default async function DesignPage() {
  await connection();
  if (!isDesignCatalogEnabled(parseEnv(process.env))) notFound();
  // The catalog's client components read the design messages; other routes never receive them.
  const { ui, design } = await getMessages();
  return (
    <NextIntlClientProvider messages={{ ui, design }}>
      <Catalog />
    </NextIntlClientProvider>
  );
}

function Catalog() {
  const t = useTranslations("design");
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </header>

      <Section id="colors" title={t("colors.title")}>
        <h3>{t("colors.palette")}</h3>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {paletteTokens.map((token) => (
            <Swatch key={token} token={token} />
          ))}
        </ul>
        <div className="grid gap-4 md:grid-cols-2">
          <Roles title={t("colors.light")} />
          <Roles title={t("colors.dark")} className="dark" />
        </div>
      </Section>

      <Section id="type" title={t("type.title")}>
        <ul className="flex flex-col gap-3">
          {TYPE_SIZES.map((size) => (
            <li key={size} className="flex flex-col gap-1">
              <code dir="ltr" className="text-xs text-muted-foreground">
                {size}
              </code>
              <span className={size}>{t("type.sample")}</span>
            </li>
          ))}
        </ul>
        <p className="font-normal">{t("type.regular")}</p>
        <p className="font-medium">{t("type.medium")}</p>
      </Section>

      <Section id="spacing" title={t("spacing.title")}>
        <ul className="flex flex-col gap-2">
          {SPACING.map(([step, width]) => (
            <li key={step} className="flex items-center gap-3">
              <code dir="ltr" className="w-8 text-xs text-muted-foreground">
                {step}
              </code>
              <span className={`h-4 rounded-xs bg-primary ${width}`} />
            </li>
          ))}
        </ul>
      </Section>

      <Section id="radius" title={t("radius.title")}>
        <ul className="flex flex-wrap gap-4">
          {RADII.map((radius) => (
            <li key={radius} className="flex flex-col items-center gap-2">
              <span className={`size-14 border bg-muted ${radius}`} />
              <code dir="ltr" className="text-xs text-muted-foreground">
                {radius}
              </code>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="elevation" title={t("elevation.title")}>
        <ul className="flex flex-wrap gap-6">
          {SHADOWS.map((shadow) => (
            <li
              key={shadow}
              className={`flex size-24 items-center justify-center rounded-lg bg-card ${shadow}`}
            >
              <code dir="ltr" className="text-xs text-muted-foreground">
                {shadow}
              </code>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="motion" title={t("motion.title")}>
        <p className="text-sm text-muted-foreground">{t("motion.hint")}</p>
        <ul className="flex flex-wrap gap-6">
          {MOTION.map(([token, duration]) => (
            <li key={token} className="flex flex-col items-center gap-2">
              <span
                data-motion={token}
                className={`size-12 rounded-md bg-primary transition-transform hover:scale-125 ${duration}`}
              />
              <code dir="ltr" className="text-xs text-muted-foreground">
                {token}
              </code>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="identity" title={t("identity.title")}>
        <ul className="grid gap-4 md:grid-cols-3">
          {ELEMENTS.map(([name, src]) => (
            <li key={name} className="relative h-32 rounded-lg border">
              <Image
                src={src}
                alt={t(`identity.${name}`)}
                fill
                unoptimized
                loading="eager"
                className="object-contain p-2"
              />
            </li>
          ))}
        </ul>
      </Section>

      <Section id="primitives" title={t("primitives.title")}>
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Primitives />
          <Overlays />
        </div>
      </Section>
    </main>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="text-2xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Swatch({ token }: { token: string }) {
  return (
    <li className="flex flex-col gap-1">
      <span
        className="h-10 rounded-md border"
        style={{ background: `var(${token})` }}
      />
      <code dir="ltr" className="text-xs">
        {token}
      </code>
    </li>
  );
}

// The semantic roles; under .dark the same names take their dark values.
function Roles({ title, className }: { title: string; className?: string }) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border bg-background p-4 text-foreground ${className ?? ""}`}
    >
      <h3>{title}</h3>
      <ul className="grid grid-cols-2 gap-3">
        {roleTokens.map((token) => (
          <Swatch key={token} token={token} />
        ))}
      </ul>
    </div>
  );
}
