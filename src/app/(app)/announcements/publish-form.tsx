"use client";

import { LoaderCircle, Megaphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSwapButton } from "@/components/motion/action-swap";
import { Input } from "@/components/motion/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import { Textarea } from "@/components/ui/textarea";
import { oneLine } from "@/platform/validation/text";
import { publishAnnouncementAction } from "./actions.ts";

const COLLEGE = "college";

// A new announcement: where it goes, its title and its text (ADR-0017). Where the viewer announces
// to one place only, it says where instead of offering a choice. Once published, the form is empty
// again and a toast says how many it reached.
export function PublishForm({
  college,
  departments,
  lengths,
}: {
  /** Whether the viewer announces to the whole college. */
  college: boolean;
  /** The active departments the viewer announces to. */
  departments: { id: string; name: string }[];
  /** How long the title and the text may be. */
  lengths: { title: number; body: number };
}) {
  const t = useTranslations("announcements.form");
  const refusals = useTranslations("actions");
  const id = useId();
  const places = [
    ...(college ? [{ id: COLLEGE, name: t("college") }] : []),
    ...departments,
  ];
  const [place, setPlace] = useState(places[0]?.id ?? COLLEGE);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<{ title?: string; body?: string }>({});
  const [refusal, setRefusal] = useState<string>();
  const [running, setRunning] = useState(false);
  const [, startTransition] = useTransition();

  const publish = () => {
    const missing = {
      title: oneLine(title) ? undefined : t("headingRequired"),
      body: body.trim() ? undefined : t("bodyRequired"),
    };
    setErrors(missing);
    if (missing.title || missing.body) return;
    startTransition(async () => {
      setRunning(true);
      setRefusal(undefined);
      const result = await publishAnnouncementAction({
        departmentId: place === COLLEGE ? null : place,
        title,
        body,
      });
      setRunning(false);
      const outcome = result?.data;
      switch (outcome?.status) {
        case "published":
          toast.success(t("published", { count: outcome.reached }));
          setTitle("");
          setBody("");
          return;
        case "inactive":
          setRefusal(t("inactive"));
          return;
        case "notFound":
          setRefusal(t("gone"));
          return;
        default:
          setRefusal(refusals(result?.serverError ?? "unexpected"));
      }
    });
  };

  return (
    <form
      noValidate
      aria-labelledby={`${id}-title`}
      onSubmit={(event) => {
        event.preventDefault();
        publish();
      }}
      className="flex flex-col gap-4 rounded-xl border bg-card px-5 py-5 shadow-xs sm:px-6"
    >
      <h2 id={`${id}-title`} className="font-medium text-base">
        {t("title")}
      </h2>
      {places.length > 1 ? (
        <div className="flex flex-col gap-1.5 sm:max-w-xs">
          <span id={`${id}-place`} className="px-1 font-medium text-sm">
            {t("scope")}
          </span>
          <Select
            aria-labelledby={`${id}-place`}
            value={place}
            onValueChange={setPlace}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {places.map((each) => (
                <SelectItem key={each.id} value={each.id}>
                  {each.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <p className="px-1 text-sm">
          <span className="font-medium">{t("scope")}</span> {places[0]?.name}
        </p>
      )}
      <Input
        label={t("heading")}
        autoComplete="off"
        maxLength={lengths.title}
        value={title}
        onChange={(text) => {
          setTitle(text);
          setErrors(({ body: kept }) => ({ body: kept }));
        }}
        error={errors.title}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-body`} className="px-1 font-medium text-sm">
          {t("body")}
        </label>
        <Textarea
          id={`${id}-body`}
          value={body}
          maxLength={lengths.body}
          onChange={(event) => {
            setBody(event.target.value);
            setErrors(({ title: kept }) => ({ title: kept }));
          }}
          aria-invalid={errors.body ? true : undefined}
          aria-describedby={`${id}-body-note`}
          // The one-line field's box: its radius, ground, padding and type.
          className="min-h-28 rounded-lg bg-background px-3.5 py-2.5 text-base md:text-base"
        />
        {errors.body ? (
          <p
            id={`${id}-body-note`}
            role="alert"
            className="px-1 text-alert text-sm"
          >
            {errors.body}
          </p>
        ) : (
          <p
            id={`${id}-body-note`}
            className="px-1 text-muted-foreground text-sm"
          >
            {t("bodyHint")}
          </p>
        )}
      </div>
      {refusal ? (
        <p role="alert" className="text-alert text-sm">
          {refusal}
        </p>
      ) : null}
      <div className="flex justify-end">
        <ActionSwapButton
          type="submit"
          disabled={running}
          value={running ? "publishing" : "publish"}
          items={[
            { id: "publish", label: t("submit"), icon: <Megaphone /> },
            {
              id: "publishing",
              label: t("publishing"),
              icon: <LoaderCircle className="animate-spin" />,
            },
          ]}
        />
      </div>
    </form>
  );
}
