import { z } from "zod";
import { oneLine } from "../../../platform/validation/text.ts";
import { type PermissionKey, permissionKeys } from "./permissions.ts";

// A role's name in the college's language, tidied as typed.
export const roleInput = z.object({
  label: z.string().transform(oneLine).pipe(z.string().min(1).max(60)),
});

// The keys a role holds on the grid: keys in code, each once.
export const rolePermissionsInput = z.object({
  permissions: z
    .array(z.enum(permissionKeys as [PermissionKey, ...PermissionKey[]]))
    .refine((keys) => new Set(keys).size === keys.length),
});

// Who holds the role, and where: across the college (null) or in one of its departments; and when:
// in every term (null or left out) or in one (Step 13).
export const membershipInput = z.object({
  userId: z.uuid(),
  roleId: z.uuid(),
  departmentId: z.uuid().nullable(),
  termId: z.uuid().nullable().optional(),
});

export type RoleInput = z.infer<typeof roleInput>;
export type RolePermissionsInput = z.infer<typeof rolePermissionsInput>;
export type MembershipInput = z.infer<typeof membershipInput>;
