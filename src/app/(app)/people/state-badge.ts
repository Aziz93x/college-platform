import type { AccountState } from "@/modules/identity";

// The badge each account state wears, in the order the list sorts them.
export const STATE_BADGE = {
  active: "success",
  invited: "pending",
  locked: "alert",
  disabled: "neutral",
} as const satisfies Record<AccountState, string>;
