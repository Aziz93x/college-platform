import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getFormatter, getMessages, getTranslations } from "next-intl/server";
import { searchCommands } from "@/components/motion/lib/command-search";
import { PageHeader } from "@/components/page-header";
import { collegeCatalog } from "@/i18n/catalog";
import { authorize, requireViewer } from "@/modules/access";
import { flatten, listTexts } from "@/modules/texts";
import { type TextRow, TextsScreen } from "./texts-screen.tsx";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("texts");
  return { title: t("title") };
}

// How many of a search's texts the page shows: enough to find the one sought, few enough for a
// phone; more words narrow it.
const SHOWN = 30;

// The platform's words (ADR-0029): the texts the college has changed, and a search over every text
// of its language's catalog by its words or its key. Each opens a sheet that changes it, or puts
// its default back.
export default async function TextsPage({ searchParams }: PageProps<"/texts">) {
  await connection();
  const viewer = await requireViewer();
  if (!authorize(viewer, "texts.manage", { collegeId: viewer.collegeId })) {
    forbidden();
  }
  const [catalog, changes, t, format, { ui, actions, texts }, params] =
    await Promise.all([
      collegeCatalog(),
      listTexts(viewer.collegeId),
      getTranslations("texts"),
      getFormatter(),
      getMessages(),
      searchParams,
    ]);
  const query = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const changed = new Map(changes.map((change) => [change.key, change]));
  const all = flatten(catalog).map(({ key, value }) => {
    const change = changed.get(key);
    // Found by its words as the college has them, its key, or its default's words.
    return {
      key,
      original: value,
      change,
      label: change?.value ?? value,
      keywords: [key, value],
    };
  });
  const found = query.trim()
    ? searchCommands(all, query)
    : all.filter(({ change }) => change);
  const rows = found
    .slice(0, SHOWN)
    .map(({ key, original, change, label }): TextRow => {
      const date = change
        ? format.dateTime(change.updatedAt, { dateStyle: "medium" })
        : undefined;
      return {
        key,
        value: label,
        original,
        changed:
          change && date
            ? change.updatedBy
              ? t("changedBy", { name: change.updatedBy, date })
              : t("changedAt", { date })
            : undefined,
      };
    });

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <NextIntlClientProvider messages={{ ui, actions, texts }}>
        <TextsScreen query={query} texts={rows} count={found.length} />
      </NextIntlClientProvider>
    </>
  );
}
