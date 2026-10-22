"use client";

import { ArrowLeftRight, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/motion/combobox";
import { Input } from "@/components/motion/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import { Button } from "@/components/ui/button";
import { oneLine } from "@/platform/validation/text";
import { transferSectionAction } from "./actions.ts";

type Person = { userId: string; name: string; employeeNumber: string };

// Transferring a section, in a sheet: the trainer it replaces when it has more than one, the new
// trainer among the department's, the week it takes effect from, and why (Step 17).
export function TransferButton({
  termId,
  sectionRef,
  trainers,
  candidates,
  weeks,
  week,
  reasonLength,
}: {
  termId: string;
  sectionRef: string;
  /** The section's trainers this week, by employee number, as the page names them. */
  trainers: { number: string; label: string }[];
  candidates: Person[];
  weeks: number;
  /** This week of the term, the week a transfer takes effect from unless another is chosen. */
  week: number;
  reasonLength: number;
}) {
  const t = useTranslations("sections.transfer");
  const ui = useTranslations("ui");
  const refusals = useTranslations("actions");
  const id = useId();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(trainers[0]?.number ?? "");
  const [to, setTo] = useState<string>();
  const [fromWeek, setFromWeek] = useState(String(week));
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ to?: string; reason?: string }>({});
  const [refusal, setRefusal] = useState<string>();
  const [running, setRunning] = useState(false);
  const [, startTransition] = useTransition();
  const people = candidates.filter(
    (person) =>
      !trainers.some((trainer) => trainer.number === person.employeeNumber),
  );

  const submit = () => {
    const missing = {
      to: to ? undefined : t("required.to"),
      reason: oneLine(reason) ? undefined : t("required.reason"),
    };
    setErrors(missing);
    if (!to || missing.reason) return;
    startTransition(async () => {
      setRunning(true);
      setRefusal(undefined);
      const result = await transferSectionAction({
        termId,
        sectionRef,
        fromNumber: from,
        toUserId: to,
        week: Number(fromWeek),
        reason,
      });
      setRunning(false);
      const status = result?.data?.status;
      if (status === "transferred") {
        toast.success(t("done", { ref: sectionRef }));
        setOpen(false);
        return;
      }
      setRefusal(
        status
          ? t(`refusals.${status}`)
          : refusals(result?.serverError ?? "unexpected"),
      );
    });
  };

  return (
    <>
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        <ArrowLeftRight aria-hidden />
        {t("button")}
      </Button>
      {open ? (
        <BottomSheet
          open
          onOpenChange={(next) => {
            if (!next) setOpen(false);
          }}
          snapPoints={["auto"]}
          title={t("title", { ref: sectionRef })}
          description={t("description")}
          closeLabel={ui("close")}
        >
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
            className="flex flex-col gap-4 pt-2 pb-2"
          >
            {trainers.length > 1 ? (
              <div className="flex flex-col gap-1.5">
                <span id={`${id}-from`} className="px-1 font-medium text-sm">
                  {t("from")}
                </span>
                <Select
                  aria-labelledby={`${id}-from`}
                  value={from}
                  onValueChange={setFrom}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {trainers.map((trainer) => (
                      <SelectItem key={trainer.number} value={trainer.number}>
                        {trainer.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="px-1 text-sm">
                <span className="font-medium">{t("from")}</span>{" "}
                {trainers[0]?.label}
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <Combobox
                value={to}
                onValueChange={(value) => {
                  setTo(value);
                  setErrors(({ reason: kept }) => ({ reason: kept }));
                }}
              >
                <ComboboxLabel>{t("to")}</ComboboxLabel>
                <ComboboxTrigger>
                  <ComboboxInput placeholder={t("toPlaceholder")} />
                </ComboboxTrigger>
                <ComboboxContent>
                  <ComboboxList aria-label={t("people")}>
                    {people.map((person) => (
                      <ComboboxItem
                        key={person.userId}
                        value={person.userId}
                        textValue={person.name}
                        keywords={[person.employeeNumber]}
                      >
                        <span className="block truncate">{person.name}</span>
                        <span
                          dir="ltr"
                          className="text-muted-foreground text-xs"
                        >
                          {person.employeeNumber}
                        </span>
                      </ComboboxItem>
                    ))}
                  </ComboboxList>
                  <ComboboxEmpty>{t("noPerson")}</ComboboxEmpty>
                </ComboboxContent>
              </Combobox>
              {errors.to ? (
                <p role="alert" className="px-1 text-alert text-sm">
                  {errors.to}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5 sm:max-w-56">
              <span id={`${id}-week`} className="px-1 font-medium text-sm">
                {t("week")}
              </span>
              <Select
                aria-labelledby={`${id}-week`}
                value={fromWeek}
                onValueChange={setFromWeek}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: weeks }, (_, at) => String(at + 1)).map(
                    (each) => (
                      <SelectItem key={each} value={each}>
                        {t("weekOption", { week: Number(each) })}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <Input
              label={t("reason")}
              autoComplete="off"
              maxLength={reasonLength}
              value={reason}
              onChange={(text) => {
                setReason(text);
                setErrors(({ to: kept }) => ({ to: kept }));
              }}
              error={errors.reason}
              hint={t("reasonHint")}
            />
            {refusal ? (
              <p role="alert" className="text-alert text-sm">
                {refusal}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <ActionSwapButton
                type="submit"
                disabled={running}
                value={running ? "running" : "idle"}
                items={[
                  { id: "idle", label: t("submit"), icon: <ArrowLeftRight /> },
                  {
                    id: "running",
                    label: t("submitting"),
                    icon: <LoaderCircle className="animate-spin" />,
                  },
                ]}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                {ui("cancel")}
              </Button>
            </div>
          </form>
        </BottomSheet>
      ) : null}
    </>
  );
}
