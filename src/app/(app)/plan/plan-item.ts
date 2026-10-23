import type { ItemView } from "../_items/item-words.tsx";

// An item of a department's plan, or of the framework beside it, as the plan's page shows it: its
// words, the weeks of the term it lands in, how many of its times fall outside the term, and the
// tasks it makes in the department, as the generation engine counts them (Step 19).
export type PlanItem = ItemView & {
  weeks: number[];
  outside: number;
  tasks: number;
};

// A term's exam period by its type's short name, from a week to a week.
export type Period = { type: string; name: string; from: number; to: number };

// A move of an item due in one week to another week.
export type Move = { itemId: string; week: number };

// Whether an item is due in one week, the only items the grid moves.
export const movable = (item: PlanItem) => item.due.type === "week";
