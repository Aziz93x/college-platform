ALTER TABLE "memberships" DROP CONSTRAINT "memberships_user_id_role_id_college_id_unique";--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memberships_role_id_index" ON "memberships" USING btree ("role_id");--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_scope_unique" UNIQUE NULLS NOT DISTINCT("user_id","role_id","department_id");