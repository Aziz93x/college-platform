"use client";

import { FileSpreadsheet } from "lucide-react";
import { useId } from "react";

// A table file to send: a people file or a Rayat report. The browser's own chooser speaks the
// browser's language, so it lies invisible over a zone in the page's, where a click opens it and
// a dropped file lands in it.
export function FileField({
  label,
  file,
  onFile,
  words,
}: {
  label: string;
  file: File | undefined;
  onFile: (file: File | undefined) => void;
  words: { choose: string; change: string; hint: string };
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${id}-file`} className="px-1 font-medium text-sm">
        {label}
      </label>
      <div className="relative flex min-h-28 flex-col items-center justify-center gap-1 rounded-lg border border-dashed bg-background px-4 py-5 text-center transition-colors hover:border-primary has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background">
        <input
          id={`${id}-file`}
          type="file"
          accept=".xlsx,.csv"
          aria-describedby={`${id}-hint`}
          onChange={(event) => onFile(event.target.files?.[0])}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
        <FileSpreadsheet aria-hidden className="mb-1 size-6 text-primary" />
        <span className="font-medium text-sm">
          {file ? <bdi>{file.name}</bdi> : words.choose}
        </span>
        <span
          id={`${id}-hint`}
          className="text-pretty text-muted-foreground text-xs"
        >
          {file ? words.change : words.hint}
        </span>
      </div>
    </div>
  );
}
