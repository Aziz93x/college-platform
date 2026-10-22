import type { ItemInput } from "./item-sheet.tsx";

// An item as its page shows it: its fields, and each in words.
export type ItemView = ItemInput & {
  id: string;
  words: {
    axis: string;
    kind: string;
    appliesTo: string;
    due: string;
    evidence: string;
  };
};

// An item in words: its title, then its axis and kind, whom it reaches and when, and its evidence.
export function ItemWords({
  item,
}: {
  item: Pick<ItemView, "title" | "notes" | "words">;
}) {
  return (
    <div className="min-w-0">
      <p className="font-medium text-sm">{item.title}</p>
      <p className="mt-0.5 text-muted-foreground text-sm">
        {item.words.axis} · {item.words.kind}
      </p>
      <p className="text-sm">
        {item.words.appliesTo} · {item.words.due}
      </p>
      <p className="text-muted-foreground text-sm">{item.words.evidence}</p>
      {item.notes ? <p className="mt-0.5 text-sm">{item.notes}</p> : null}
    </div>
  );
}
