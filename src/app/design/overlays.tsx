"use client";

import { BookOpen } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { CommandPalette } from "@/components/motion/command-palette";
import {
  type DateRange,
  DateRangePickerDropdown,
} from "@/components/motion/date-range-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDateRangeWords } from "@/components/use-date-range-words";
import { firstDayOfWeek } from "@/platform/i18n/language";
import { Demo } from "./demo";

const SAMPLES = ["one", "two", "three"] as const;
// A fixed sample day, so the picker opens on the same month and today on every run.
const SAMPLE_DAY = "2026-10-22";

// What opens over the page, each from a labelled trigger: the sheet that confirms, the page search,
// the period picker, and the dialog, tooltip and toast.
export function Overlays() {
  const t = useTranslations("design");
  const locale = useLocale();
  const words = useDateRangeWords(t("period.label"));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [chosen, setChosen] = useState<string>();
  const [range, setRange] = useState<DateRange | null>(null);

  return (
    <TooltipProvider>
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

      <Demo id="date-range" title={t("primitives.date-range")}>
        <div className="flex w-full flex-col gap-1.5 sm:w-72">
          {/* The trigger's name carries the label with the chosen period. */}
          <span aria-hidden className="px-1 font-medium text-sm">
            {t("period.label")}
          </span>
          <DateRangePickerDropdown
            value={range}
            onValueChange={setRange}
            words={words}
            locale={locale}
            weekStartsOn={firstDayOfWeek(locale)}
            today={SAMPLE_DAY}
            className="w-full"
          />
        </div>
      </Demo>

      <Demo id="dialog" title={t("primitives.dialog")}>
        <Dialog>
          <DialogTrigger asChild>
            <Button>{t("dialog.trigger")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("dialog.title")}</DialogTitle>
              <DialogDescription>{t("dialog.description")}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">{t("dialog.cancel")}</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button>{t("dialog.confirm")}</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Demo>

      <Demo id="tooltip" title={t("primitives.tooltip")}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline">{t("tooltip.trigger")}</Button>
          </TooltipTrigger>
          <TooltipContent>{t("tooltip.content")}</TooltipContent>
        </Tooltip>
      </Demo>

      <Demo id="sonner" title={t("primitives.sonner")}>
        <Button
          variant="outline"
          onClick={() =>
            toast(t("toast.title"), { description: t("toast.description") })
          }
        >
          {t("toast.trigger")}
        </Button>
      </Demo>
    </TooltipProvider>
  );
}
