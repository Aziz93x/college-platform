"use client";

import "./globals.css";
import { documentLocale, languages } from "@/platform/i18n/language";
import { identityFont } from "@/styles/fonts";
import messages from "../../messages/ar.json" with { type: "json" };

// Replaces the root layout when it fails, so it reads nothing from the database: the document takes
// the default language, and the words come from that language's catalog, imported here.
const { lang, dir } = documentLocale(languages[0]);
const { title, description, retry: retryLabel } = messages.ui.error;

export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang={lang} dir={dir} className={`${identityFont.variable} h-full`}>
      <body className="flex min-h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <title>{title}</title>
        <h1 className="text-2xl">{title}</h1>
        <p className="max-w-md text-muted-foreground">{description}</p>
        <button
          type="button"
          onClick={() => retry()}
          className="h-11 rounded-md bg-primary px-4 font-medium text-primary-foreground text-sm"
        >
          {retryLabel}
        </button>
      </body>
    </html>
  );
}
