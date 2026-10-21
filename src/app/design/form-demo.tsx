"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { latinDigits } from "@/platform/validation/form";

// react-hook-form with a Zod schema: Arabic-Indic digits are read, and kept, as Latin ones.
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
              <FormLabel>{t("label")}</FormLabel>
              <FormControl>
                <Input
                  inputMode="numeric"
                  {...field}
                  value={String(field.value ?? "")}
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
