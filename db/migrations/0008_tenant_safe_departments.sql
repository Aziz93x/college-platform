ALTER TABLE "departments" ADD CONSTRAINT "departments_college_id_id_unique" UNIQUE("college_id","id");--> statement-breakpoint
ALTER TABLE "memberships" DROP CONSTRAINT "memberships_department_id_departments_id_fk";
--> statement-breakpoint
ALTER TABLE "department_rayat_values" DROP CONSTRAINT "department_rayat_values_department_id_departments_id_fk";
--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_department_fk" FOREIGN KEY ("college_id","department_id") REFERENCES "public"."departments"("college_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_rayat_values" ADD CONSTRAINT "department_rayat_values_department_fk" FOREIGN KEY ("college_id","department_id") REFERENCES "public"."departments"("college_id","id") ON DELETE cascade ON UPDATE no action;
