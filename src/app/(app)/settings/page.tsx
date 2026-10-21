import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { authorize, requireViewer } from "@/modules/access";
import {
  needsPassword,
  type SettingKey,
  settingControl,
  settingGroups,
  settingsRegistry,
  settingValue,
  storedSettings,
} from "@/modules/settings";
import type { SettingView } from "./setting-view.ts";
import { SettingsScreen } from "./settings-screen.tsx";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const t = await getTranslations("settings");
  return { title: t("title") };
}

// The college's settings, drawn from their schemas: every setting with a control whose permission
// the viewer holds. Someone who holds none of them gets the page's refusal.
export default async function SettingsPage({
  searchParams,
}: PageProps<"/settings">) {
  await connection();
  const viewer = await requireViewer();
  const scope = { collegeId: viewer.collegeId };
  const stored = await storedSettings(viewer.collegeId);
  const settings: SettingView[] = [];
  for (const key of Object.keys(settingsRegistry) as SettingKey[]) {
    const setting = settingsRegistry[key];
    const control = settingControl(key);
    if (!control || !authorize(viewer, setting.permission, scope)) continue;
    settings.push({
      key,
      group: setting.group,
      control,
      unit: "unit" in setting ? setting.unit : undefined,
      value: settingValue(key, stored, viewer.collegeId),
      defaultValue: setting.default,
      needsPassword: needsPassword(key),
    });
  }
  if (settings.length === 0) forbidden();

  const groups = settingGroups.filter((group) =>
    settings.some((setting) => setting.group === group),
  );
  const asked = (await searchParams).group;
  const initialGroup = groups.find((group) => group === asked) ?? groups[0];
  const [t, { ui, actions, platform, reauth, settings: words }] =
    await Promise.all([getTranslations("settings"), getMessages()]);
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      {/* The screen's words, and the catalog's own a setting left empty stands for. */}
      <NextIntlClientProvider
        messages={{ ui, actions, platform, reauth, settings: words }}
      >
        <SettingsScreen
          settings={settings}
          groups={groups}
          initialGroup={initialGroup}
        />
      </NextIntlClientProvider>
    </>
  );
}
