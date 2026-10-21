"use client";

import { BookOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { CommandPalette } from "@/components/motion/command-palette";
import { Button } from "@/components/ui/button";
import { Demo } from "./demo";

const SAMPLES = ["one", "two", "three"] as const;

// The BeUI motion components (src/components/motion/PROVENANCE.md), each from a labelled trigger.
export function MotionDemos() {
  const t = useTranslations("design");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [chosen, setChosen] = useState<string>();

  return (
    <>
      <Demo id="bottom-sheet" title={t("primitives.bottom-sheet")}>
        <Button variant="outline" onClick={() => setSheetOpen(true)}>
          {t("bottomSheet.trigger")}
        </Button>
        <BottomSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          snapPoints={["auto"]}
          title={t("bottomSheet.title")}
          description={t("bottomSheet.description")}
          closeLabel={t("bottomSheet.close")}
        >
          <ul className="flex flex-col gap-2 pt-2">
            {SAMPLES.map((sample) => (
              <li key={sample}>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setSheetOpen(false)}
                >
                  {t(`bottomSheet.${sample}`)}
                </Button>
              </li>
            ))}
          </ul>
        </BottomSheet>
      </Demo>

      <Demo id="command-palette" title={t("primitives.command-palette")}>
        <Button variant="outline" onClick={() => setPaletteOpen(true)}>
          {t("commandPalette.trigger")}
        </Button>
        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          items={SAMPLES.map((sample) => ({
            id: sample,
            label: t(`commandPalette.${sample}`),
            icon: <BookOpen />,
            onSelect: () => setChosen(t(`commandPalette.${sample}`)),
          }))}
          placeholder={t("commandPalette.placeholder")}
          emptyMessage={t("commandPalette.empty")}
          labels={{
            dialog: t("commandPalette.dialog"),
            list: t("commandPalette.list"),
            close: t("commandPalette.close"),
            escape: t("commandPalette.escape"),
          }}
        />
        <output className="text-muted-foreground text-sm">
          {chosen ? t("commandPalette.chosen", { name: chosen }) : null}
        </output>
      </Demo>
    </>
  );
}
