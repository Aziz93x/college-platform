// The primitives in this folder come from shadcn/ui: shadcn-ui/ui at commit
// ba1503c64472b82256d9de95e2e62c5901a38e8b, apps/v4/registry/new-york-v4/ui (components.json
// points at that commit's schema). They are restyled with the identity tokens: semantic color
// roles only, --alert for destructive and invalid states, logical properties for right to left
// (shadcn migrate rtl, then by hand) and the motion tokens.
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
