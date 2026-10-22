"use client";

import { Megaphone } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { markReadAction } from "../notifications/actions.ts";

// An announcement as the dialog shows it: its words, who made it and where, and when.
export type AnnouncementItem = {
  id: string;
  title: string;
  body: string;
  from: string;
  ago: string;
  iso: string;
};

// What was announced to the person and is not closed yet, newest first (ADR-0017): one at a time,
// in the middle of the page over the page blurred, until it is closed. Closing reads it, so it does
// not come back, and the next one follows; it stays in the notification center. Escape closes it as
// the button does; a tap beside it does not.
export function Announcements({
  items,
  labels,
}: {
  items: AnnouncementItem[];
  labels: { eyebrow: string; close: string };
}) {
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const [, startClosing] = useTransition();
  const current = items.find((item) => !closed.has(item.id));

  const close = () => {
    if (!current) return;
    setClosed((before) => new Set(before).add(current.id));
    startClosing(async () => {
      await markReadAction({ ids: [current.id] });
    });
  };

  return (
    <Dialog
      open={current !== undefined}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      {current ? (
        <DialogContent
          key={current.id}
          showCloseButton={false}
          overlayClassName="bg-background/30 backdrop-blur-md"
          onPointerDownOutside={(event) => event.preventDefault()}
          className="max-h-[85dvh] overflow-y-auto"
        >
          <p className="flex items-center gap-2 font-medium text-primary text-sm">
            <Megaphone aria-hidden className="size-4" />
            {labels.eyebrow}
          </p>
          <DialogTitle className="text-xl leading-snug">
            {current.title}
          </DialogTitle>
          <p className="text-muted-foreground text-xs">
            {current.from}
            <span aria-hidden> · </span>
            <time dateTime={current.iso}>{current.ago}</time>
          </p>
          <DialogDescription className="whitespace-pre-line text-pretty text-base text-foreground leading-relaxed">
            {current.body}
          </DialogDescription>
          <Button
            type="button"
            onClick={close}
            className="w-full sm:w-auto sm:justify-self-end"
          >
            {labels.close}
          </Button>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
