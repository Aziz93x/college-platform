"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Demo, Field } from "./demo";

// A fixed sample day, so the calendar shows the same month and today on every run.
const SAMPLE_DAY = new Date(2026, 9, 22);

const WEEKS = ["one", "two", "three"] as const;

// The primitives that open over the page, each from a labelled trigger.
export function Overlays() {
  const t = useTranslations("design");
  const [day, setDay] = useState<Date | undefined>(SAMPLE_DAY);
  const [showDone, setShowDone] = useState(true);

  return (
    <TooltipProvider>
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

      <Demo id="sheet" title={t("primitives.sheet")}>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">{t("sheet.trigger")}</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{t("sheet.title")}</SheetTitle>
              <SheetDescription>{t("sheet.description")}</SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      </Demo>

      <Demo id="drawer" title={t("primitives.drawer")}>
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="outline">{t("drawer.trigger")}</Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{t("drawer.title")}</DrawerTitle>
              <DrawerDescription>{t("drawer.description")}</DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">{t("dialog.cancel")}</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </Demo>

      <Demo id="dropdown-menu" title={t("primitives.dropdown-menu")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">{t("dropdown.trigger")}</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>{t("dropdown.label")}</DropdownMenuLabel>
            <DropdownMenuItem>{t("dropdown.edit")}</DropdownMenuItem>
            <DropdownMenuItem>{t("dropdown.copy")}</DropdownMenuItem>
            <DropdownMenuCheckboxItem
              checked={showDone}
              onCheckedChange={setShowDone}
            >
              {t("dropdown.showDone")}
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">
              {t("dropdown.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Demo>

      <Demo id="popover" title={t("primitives.popover")}>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">{t("popover.trigger")}</Button>
          </PopoverTrigger>
          <PopoverContent aria-labelledby="popover-title">
            <PopoverHeader>
              <PopoverTitle id="popover-title">
                {t("popover.title")}
              </PopoverTitle>
              <PopoverDescription>
                {t("popover.description")}
              </PopoverDescription>
            </PopoverHeader>
          </PopoverContent>
        </Popover>
      </Demo>

      <Demo id="tooltip" title={t("primitives.tooltip")}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline">{t("tooltip.trigger")}</Button>
          </TooltipTrigger>
          <TooltipContent>{t("tooltip.content")}</TooltipContent>
        </Tooltip>
      </Demo>

      <Demo id="select" title={t("primitives.select")}>
        <Field id="select-default" label={t("select.label")}>
          <Select>
            <SelectTrigger id="select-default" className="w-full">
              <SelectValue placeholder={t("select.placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {WEEKS.map((week) => (
                <SelectItem key={week} value={week}>
                  {t(`select.${week}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="select-disabled" label={t("states.disabled")}>
          <Select disabled>
            <SelectTrigger id="select-disabled" className="w-full">
              <SelectValue placeholder={t("select.placeholder")} />
            </SelectTrigger>
          </Select>
        </Field>
        <Field
          id="select-invalid"
          label={t("states.invalid")}
          error={t("sample.required")}
        >
          <Select>
            <SelectTrigger
              id="select-invalid"
              aria-invalid
              aria-describedby="select-invalid-error"
              className="w-full"
            >
              <SelectValue placeholder={t("select.placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {WEEKS.map((week) => (
                <SelectItem key={week} value={week}>
                  {t(`select.${week}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </Demo>

      <Demo id="command" title={t("primitives.command")}>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">{t("command.trigger")}</Button>
          </DialogTrigger>
          <DialogContent className="overflow-hidden p-0">
            <DialogHeader className="sr-only">
              <DialogTitle>{t("command.title")}</DialogTitle>
              <DialogDescription>{t("command.description")}</DialogDescription>
            </DialogHeader>
            <Command label={t("command.title")}>
              <CommandInput placeholder={t("command.placeholder")} />
              <CommandList label={t("command.results")}>
                <CommandEmpty>{t("command.empty")}</CommandEmpty>
                <CommandGroup heading={t("command.group")}>
                  <CommandItem>{t("command.today")}</CommandItem>
                  <CommandItem>{t("command.tasks")}</CommandItem>
                  <CommandItem>{t("command.evidence")}</CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </DialogContent>
        </Dialog>
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

      <Demo id="calendar" title={t("primitives.calendar")}>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">{t("calendar.trigger")}</Button>
          </PopoverTrigger>
          <PopoverContent
            aria-label={t("calendar.trigger")}
            className="w-auto p-0"
            align="start"
          >
            <Calendar
              mode="single"
              selected={day}
              onSelect={setDay}
              defaultMonth={SAMPLE_DAY}
              today={SAMPLE_DAY}
            />
          </PopoverContent>
        </Popover>
      </Demo>
    </TooltipProvider>
  );
}
