"use client";

import {
  BellRing,
  ClipboardCheck,
  FolderUp,
  Languages,
  type LucideIcon,
  MonitorCog,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/motion/input";
import { searchCommands } from "@/components/motion/lib/command-search";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/motion/tabs";
import type { SettingGroup, SettingKey } from "@/modules/settings";
import { SettingRow } from "./setting-row.tsx";
import type { SettingView } from "./setting-view.ts";
import { useSettingWords } from "./use-setting-words.ts";

const GROUP_ICONS: Record<SettingGroup, LucideIcon> = {
  platform: MonitorCog,
  locale: Languages,
  security: ShieldCheck,
  files: FolderUp,
  review: ClipboardCheck,
  reminders: BellRing,
};

// The settings the viewer may change, a tab per group, and a search across all of them. The group
// on show is in the address (?group=), so a reload or a shared link opens it again. What is being
// edited is held here, so it survives a change of tab or a search.
export function SettingsScreen({
  settings,
  groups,
  initialGroup,
}: {
  settings: SettingView[];
  groups: SettingGroup[];
  initialGroup: SettingGroup;
}) {
  const words = useSettingWords();
  const { t } = words;
  const [group, setGroup] = useState(initialGroup);
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Partial<Record<SettingKey, unknown>>>(
    {},
  );
  const draftFor = useCallback(
    (key: SettingKey) => (draft: unknown) =>
      setDrafts((all) => {
        const next = { ...all };
        if (draft === undefined) delete next[key];
        else next[key] = draft;
        return next;
      }),
    [],
  );

  const changeGroup = (next: string) => {
    setGroup(next as SettingGroup);
    const url = new URL(window.location.href);
    url.searchParams.set("group", next);
    window.history.replaceState(window.history.state, "", url);
  };

  const row = (setting: SettingView) => (
    <li key={setting.key}>
      <SettingRow
        setting={setting}
        draft={drafts[setting.key]}
        onDraft={draftFor(setting.key)}
      />
    </li>
  );
  const list = (items: SettingView[]) => (
    // No overflow clipping: a choice's list opens over the rows below.
    <ul className="divide-y rounded-xl border bg-card shadow-xs">
      {items.map(row)}
    </ul>
  );

  const searching = query.trim() !== "";
  const results = searching
    ? searchCommands(
        settings.map((setting) => ({
          setting,
          label: words.label(setting),
          group: t(`groups.${setting.group}`),
          keywords: [words.description(setting)],
        })),
        query,
      ).map((result) => result.setting)
    : [];

  return (
    <Tabs value={group} onValueChange={changeGroup}>
      <div className="flex flex-col gap-3 lg:flex-row-reverse lg:items-center lg:justify-between">
        <Input
          type="search"
          label={t("search.label")}
          hideLabel
          placeholder={t("search.placeholder")}
          value={query}
          onChange={setQuery}
          onKeyDown={(event) => {
            if (event.key === "Escape") setQuery("");
          }}
          startIcon={<Search />}
          endSlot={
            searching ? (
              <button
                type="button"
                aria-label={t("search.clear")}
                onClick={() => setQuery("")}
              >
                <X aria-hidden />
              </button>
            ) : undefined
          }
          className="w-full lg:w-80"
        />
        <div hidden={searching} className="min-w-0">
          <TabsList
            label={t("groupsLabel")}
            scrollLabels={{ left: t("scroll.left"), right: t("scroll.right") }}
          >
            {groups.map((name) => {
              const Icon = GROUP_ICONS[name];
              return (
                <TabsTrigger key={name} value={name} icon={<Icon />}>
                  {t(`groups.${name}`)}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
      </div>
      <p aria-live="polite" className="sr-only">
        {searching ? t("search.results", { count: results.length }) : ""}
      </p>
      <div className="mt-5">
        {searching ? (
          results.length > 0 ? (
            <div className="flex flex-col gap-6">
              {groups
                .filter((name) => results.some((s) => s.group === name))
                .map((name) => (
                  <section key={name} aria-labelledby={`results-${name}`}>
                    <h2
                      id={`results-${name}`}
                      className="mb-3 px-1 font-medium text-muted-foreground text-sm"
                    >
                      {t(`groups.${name}`)}
                    </h2>
                    {list(results.filter((s) => s.group === name))}
                  </section>
                ))}
            </div>
          ) : (
            <EmptyState
              title={t("search.empty.title")}
              description={t("search.empty.description")}
            />
          )
        ) : (
          groups.map((name) => (
            <TabsContent key={name} value={name}>
              {list(settings.filter((setting) => setting.group === name))}
            </TabsContent>
          ))
        )}
      </div>
    </Tabs>
  );
}
