"use client";

import {
  BellRing,
  CalendarRange,
  ClipboardCheck,
  FolderUp,
  Languages,
  type LucideIcon,
  MonitorCog,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useState } from "react";
import { searchCommands } from "@/components/motion/lib/command-search";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/motion/tabs";
import { NoResults, SearchField } from "@/components/search-field";
import type { SettingGroup, SettingKey } from "@/modules/settings";
import { toLatinDigits } from "@/platform/validation/digits";
import { SettingRow } from "./setting-row.tsx";
import type { SettingView } from "./setting-view.ts";
import { useSettingWords } from "./use-setting-words.ts";

const GROUP_ICONS: Record<SettingGroup, LucideIcon> = {
  platform: MonitorCog,
  locale: Languages,
  calendar: CalendarRange,
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
    // No state of its own: the router then keeps this address, and a save's refresh does not put
    // the one before it back (lead review B).
    window.history.replaceState(null, "", url);
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
        toLatinDigits(query),
      ).map((result) => result.setting)
    : [];

  return (
    <Tabs value={group} onValueChange={changeGroup}>
      <div className="flex flex-col gap-3 lg:flex-row-reverse lg:items-center lg:justify-between">
        <SearchField
          label={t("search.label")}
          placeholder={t("search.placeholder")}
          value={query}
          onChange={setQuery}
          results={results.length}
          className="lg:w-80"
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
            <NoResults query={query} onClear={() => setQuery("")} />
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
