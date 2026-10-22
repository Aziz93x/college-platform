import { Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Demo, Field } from "./demo";
import { FormDemo } from "./form-demo";

// The ring the primitives draw on :focus-visible, drawn at rest so the catalog shows it.
const FOCUS_RING = "border-ring ring-[3px] ring-ring/50";

// Sample values: fixed, so the page renders the same on every run.
const PROGRESS_SAMPLES = [0, 40, 100];
const SCROLL_ITEMS = Array.from({ length: 12 }, (_, index) => index + 1);

// The shadcn/ui primitives no BeUI component replaces (docs/design/beui-map.md).
export function Primitives() {
  const t = useTranslations("design");

  return (
    <>
      <Demo id="button" title={t("primitives.button")}>
        <Button>{t("button.primary")}</Button>
        <Button variant="secondary">{t("button.secondary")}</Button>
        <Button variant="outline">{t("button.outline")}</Button>
        <Button variant="ghost">{t("button.ghost")}</Button>
        <Button variant="link">{t("button.link")}</Button>
        <Button variant="destructive">{t("button.destructive")}</Button>
        <Button className={FOCUS_RING}>{t("states.focus")}</Button>
        <Button disabled>{t("states.disabled")}</Button>
        <Button disabled aria-busy>
          <Loader2Icon className="animate-spin" />
          {t("states.loading")}
        </Button>
      </Demo>

      <Demo id="textarea" title={t("primitives.textarea")}>
        <Field id="textarea-default" label={t("states.default")}>
          <Textarea
            id="textarea-default"
            placeholder={t("sample.placeholder")}
          />
        </Field>
        <Field id="textarea-filled" label={t("states.filled")}>
          <Textarea id="textarea-filled" defaultValue={t("sample.note")} />
        </Field>
        <Field id="textarea-disabled" label={t("states.disabled")}>
          <Textarea id="textarea-disabled" disabled />
        </Field>
        <Field
          id="textarea-invalid"
          label={t("states.invalid")}
          error={t("sample.required")}
        >
          <Textarea
            id="textarea-invalid"
            aria-invalid
            aria-describedby="textarea-invalid-error"
          />
        </Field>
      </Demo>

      <Demo id="label" title={t("primitives.label")}>
        <div className="grid w-full gap-2 sm:w-56">
          <Label htmlFor="label-default">{t("label.text")}</Label>
          <Textarea id="label-default" defaultValue={t("sample.value")} />
        </div>
      </Demo>

      <Demo id="form" title={t("primitives.form")}>
        <FormDemo />
      </Demo>

      <Demo id="radio-group" title={t("primitives.radio-group")}>
        <div className="grid gap-3">
          <p id="radio-label" className="text-sm font-medium">
            {t("radio.label")}
          </p>
          <RadioGroup defaultValue="file" aria-labelledby="radio-label">
            {(["file", "photo", "link"] as const).map((value) => (
              <div key={value} className="flex items-center gap-2">
                <RadioGroupItem
                  id={`radio-${value}`}
                  value={value}
                  disabled={value === "link"}
                />
                <Label htmlFor={`radio-${value}`}>{t(`radio.${value}`)}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      </Demo>

      <Demo id="avatar" title={t("primitives.avatar")}>
        {(["sm", "default", "lg"] as const).map((size) => (
          <Avatar key={size} size={size}>
            <AvatarFallback>{t("avatar.initials")}</AvatarFallback>
          </Avatar>
        ))}
      </Demo>

      <Demo id="skeleton" title={t("primitives.skeleton")}>
        <div className="flex w-full items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="grid min-w-0 flex-1 gap-2">
            <Skeleton className="h-4 w-full max-w-48" />
            <Skeleton className="h-4 w-2/3 max-w-32" />
          </div>
        </div>
      </Demo>

      <Demo id="progress" title={t("primitives.progress")}>
        <div className="grid w-full gap-4">
          {PROGRESS_SAMPLES.map((value) => (
            <Progress
              key={value}
              value={value}
              aria-label={t("progress.label", { value: String(value) })}
            />
          ))}
        </div>
      </Demo>

      <Demo id="separator" title={t("primitives.separator")}>
        <div className="grid w-full gap-3">
          <p>{t("separator.first")}</p>
          <Separator />
          <div className="flex h-5 items-center gap-3 text-sm">
            <span>{t("separator.second")}</span>
            <Separator orientation="vertical" />
            <span>{t("separator.third")}</span>
          </div>
        </div>
      </Demo>

      <Demo id="scroll-area" title={t("primitives.scroll-area")}>
        <ScrollArea className="h-40 w-full rounded-md border sm:w-56">
          <ul className="p-3 text-sm">
            {SCROLL_ITEMS.map((number) => (
              <li key={number} className="py-1.5">
                {t("scroll.item", { number: String(number) })}
              </li>
            ))}
          </ul>
        </ScrollArea>
      </Demo>
    </>
  );
}
