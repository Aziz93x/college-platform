"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Input } from "@/components/motion/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { latinDigits } from "@/platform/validation/form";

// react-hook-form with a Zod schema, on the screens' text field, which names itself: Arabic-Indic
// digits are read, and kept, as Latin ones.
export function FormDemo() {
  const t = useTranslations("design.form");
  const error = { error: t("invalid") };
  const schema = z.object({
    sections: latinDigits(z.coerce.number(error).int(error).positive(error)),
  });
  const form = useForm<
    z.input<typeof schema>,
    unknown,
    z.output<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues: { sections: "" },
  });
  const [saved, setSaved] = useState<number>();

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(({ sections }) => setSaved(sections))}
        className="grid w-full gap-4 sm:w-72"
      >
        <FormField
          control={form.control}
          name="sections"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  label={t("label")}
                  inputMode="numeric"
                  name={field.name}
                  value={String(field.value ?? "")}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
              </FormControl>
              <FormDescription>{t("description")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-fit">
          {t("submit")}
        </Button>
        <output className="text-sm">
          {saved !== undefined && t("saved", { value: String(saved) })}
        </output>
      </form>
    </Form>
  );
}
