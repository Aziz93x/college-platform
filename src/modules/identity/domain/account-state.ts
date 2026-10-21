// What the people list says about an account, the first that holds: disabled by an admin, locked by
// wrong passwords, invited while its temporary password waits to be replaced, or active.
export type AccountState = "disabled" | "locked" | "invited" | "active";

export function accountState(account: {
  disabled: boolean;
  locked: boolean;
  mustChangePassword: boolean;
}): AccountState {
  if (account.disabled) return "disabled";
  if (account.locked) return "locked";
  if (account.mustChangePassword) return "invited";
  return "active";
}
