ALTER TABLE "users" ADD COLUMN "disabled_at" timestamp with time zone;--> statement-breakpoint
-- The head's new default keys for colleges seeded before Step 10: the base seed gives a role its keys only when it creates the role (Audit 3).
INSERT INTO "role_permissions" ("role_id", "permission") SELECT "id", 'accounts.resetPassword' FROM "roles" WHERE "key" = 'head' ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission") SELECT "id", 'accounts.linkEmployeeNumber' FROM "roles" WHERE "key" = 'head' ON CONFLICT DO NOTHING;
