import { Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Demo, Field } from "./demo";
import { FormDemo } from "./form-demo";

// The ring the primitives draw on :focus-visible, drawn at rest so the catalog shows it.
const FOCUS_RING = "border-ring ring-[3px] ring-ring/50";

// A control and its label on one row, 44 px high on a touch screen so that the hit areas of the
// rows never overlap.
const TOUCH_ROW = "flex items-center gap-2 pointer-coarse:min-h-11";

// Sample values: fixed, so the page renders the same on every run.
const PROGRESS_SAMPLES = [0, 40, 100];
const SCROLL_ITEMS = Array.from({ length: 12 }, (_, index) => index + 1);

export function Primitives() {
  const t = useTranslations("design");
  const rows = t.raw("table.rows") as string[][];

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

      <Demo id="input" title={t("primitives.input")}>
        <Field id="input-default" label={t("states.default")}>
          <Input id="input-default" placeholder={t("sample.placeholder")} />
        </Field>
        <Field id="input-filled" label={t("states.filled")}>
          <Input id="input-filled" defaultValue={t("sample.value")} />
        </Field>
        <Field id="input-focus" label={t("states.focus")}>
          <Input id="input-focus" className={FOCUS_RING} />
        </Field>
        <Field id="input-disabled" label={t("states.disabled")}>
          <Input id="input-disabled" disabled />
        </Field>
        <Field
          id="input-invalid"
          label={t("states.invalid")}
          error={t("sample.required")}
        >
          <Input
            id="input-invalid"
            aria-invalid
            aria-describedby="input-invalid-error"
          />
        </Field>
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
        <div className="grid gap-2">
          <Label htmlFor="label-default">{t("label.text")}</Label>
          <Input id="label-default" defaultValue={t("sample.value")} />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="label-disabled" disabled />
          <Label htmlFor="label-disabled">{t("states.disabled")}</Label>
        </div>
      </Demo>

      <Demo id="form" title={t("primitives.form")}>
        <FormDemo />
      </Demo>

      <Demo id="checkbox" title={t("primitives.checkbox")}>
        {(
          [
            ["checkbox-checked", "states.checked", { defaultChecked: true }],
            ["checkbox-unchecked", "states.unchecked", {}],
            ["checkbox-disabled", "states.disabled", { disabled: true }],
          ] as const
        ).map(([id, label, props]) => (
          <div key={id} className={TOUCH_ROW}>
            <Checkbox id={id} {...props} />
            <Label htmlFor={id}>{t(label)}</Label>
          </div>
        ))}
        <div className="grid gap-2">
          <div className={TOUCH_ROW}>
            <Checkbox
              id="checkbox-invalid"
              aria-invalid
              aria-describedby="checkbox-invalid-error"
            />
            <Label htmlFor="checkbox-invalid">{t("states.invalid")}</Label>
          </div>
          <p id="checkbox-invalid-error" className="text-sm text-alert">
            {t("sample.required")}
          </p>
        </div>
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

      <Demo id="switch" title={t("primitives.switch")}>
        {(
          [
            ["switch-checked", "states.checked", { defaultChecked: true }],
            ["switch-unchecked", "states.unchecked", {}],
            ["switch-disabled", "states.disabled", { disabled: true }],
          ] as const
        ).map(([id, label, props]) => (
          <div key={id} className="flex items-center gap-2">
            <Switch id={id} {...props} />
            <Label htmlFor={id}>{t(label)}</Label>
          </div>
        ))}
      </Demo>

      <Demo id="tabs" title={t("primitives.tabs")}>
        <Tabs defaultValue="week" className="w-full">
          <TabsList>
            <TabsTrigger value="week">{t("tabs.week")}</TabsTrigger>
            <TabsTrigger value="month">{t("tabs.month")}</TabsTrigger>
            <TabsTrigger value="term" disabled>
              {t("tabs.term")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="week">{t("tabs.weekBody")}</TabsContent>
          <TabsContent value="month">{t("tabs.monthBody")}</TabsContent>
        </Tabs>
      </Demo>

      <Demo id="table" title={t("primitives.table")}>
        <Table>
          <TableCaption>{t("table.caption")}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.section")}</TableHead>
              <TableHead>{t("table.tasks")}</TableHead>
              <TableHead>{t("table.done")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(([section, tasks, done]) => (
              <TableRow key={section}>
                <TableCell>{section}</TableCell>
                <TableCell>{tasks}</TableCell>
                <TableCell>{done}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Table>
          <TableCaption>{t("states.empty")}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.section")}</TableHead>
              <TableHead>{t("table.tasks")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={2} className="text-muted-foreground">
                {t("table.empty")}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Demo>

      <Demo id="badge" title={t("primitives.badge")}>
        <Badge>{t("badge.done")}</Badge>
        <Badge variant="secondary">{t("badge.draft")}</Badge>
        <Badge variant="outline">{t("badge.review")}</Badge>
        <Badge variant="destructive">{t("badge.late")}</Badge>
      </Demo>

      <Demo id="avatar" title={t("primitives.avatar")}>
        {(["sm", "default", "lg"] as const).map((size) => (
          <Avatar key={size} size={size}>
            <AvatarFallback>{t("avatar.initials")}</AvatarFallback>
          </Avatar>
        ))}
      </Demo>

      <Demo id="skeleton" title={t("primitives.skeleton")}>
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="grid gap-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
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
