"use client";

import { Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { Input } from "@/components/motion/input";
import { cn } from "@/components/ui/cn";

// What a typed entry becomes: the entry to add, why it cannot join the list, or nothing to add.
export type ListEntry = { item: string } | { problem: string } | undefined;

// A list of short entries: each one a chip that can be removed, and a field that adds the next one
// (Enter or the plus). The page reads what was typed into an entry, or says why it cannot join. A
// page that saves an entry still in the field holds what is typed (typed, onTypedChange).
export function ListField({
  label,
  items,
  onChange,
  read,
  error,
  words,
  itemDir = "auto",
  typed,
  onTypedChange,
  className,
}: {
  /** Names the list. */
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  read: (typed: string, items: string[]) => ListEntry;
  error?: string;
  words: {
    placeholder: string;
    add: string;
    remove: (item: string) => string;
  };
  /** Entries in a script of their own, such as file extensions, read left to right. */
  itemDir?: "ltr" | "auto";
  typed?: string;
  onTypedChange?: (typed: string) => void;
  className?: string;
}) {
  const [ownTyped, setOwnTyped] = useState("");
  const next = typed ?? ownTyped;
  const setNext = onTypedChange ?? setOwnTyped;
  const [problem, setProblem] = useState<string>();
  const listId = useId();

  const add = () => {
    const entry = read(next, items);
    if (!entry) return;
    if ("problem" in entry) {
      setProblem(entry.problem);
    } else {
      onChange([...items, entry.item]);
      setNext("");
      setProblem(undefined);
    }
  };

  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      {/* 12 px apart: each remove button's 44 px hit area stays clear of its neighbours'. */}
      <ul id={listId} aria-label={label} className="flex flex-wrap gap-3">
        {items.map((item) => (
          <li
            key={item}
            dir={itemDir}
            className="inline-flex h-8 items-center gap-1 rounded-full border bg-muted ps-3 pe-1 font-medium text-sm"
          >
            {item}
            <button
              type="button"
              aria-label={words.remove(item)}
              onClick={() => onChange(items.filter((other) => other !== item))}
              className="relative grid size-6 place-items-center rounded-full text-muted-foreground transition-colors after:absolute after:-inset-2.5 after:content-[''] hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <Input
        label={words.placeholder}
        hideLabel
        aria-controls={listId}
        autoComplete="off"
        value={next}
        onChange={(text) => {
          setNext(text);
          setProblem(undefined);
        }}
        onKeyDown={(event) => {
          // Enter adds the entry rather than submitting the form around it.
          if (event.key === "Enter") {
            event.preventDefault();
            add();
          }
        }}
        placeholder={words.placeholder}
        error={problem ?? error}
        endSlot={
          <button type="button" aria-label={words.add} onClick={add}>
            <Plus aria-hidden />
          </button>
        }
      />
    </div>
  );
}
