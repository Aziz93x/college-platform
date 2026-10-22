import type { TermStatus } from "@/modules/terms";

// How a term's status is badged: the active term as the one in force, a draft as still to come.
export const STATUS_BADGE = {
  draft: "pending",
  active: "success",
  closed: "neutral",
} as const satisfies Record<TermStatus, "pending" | "success" | "neutral">;
