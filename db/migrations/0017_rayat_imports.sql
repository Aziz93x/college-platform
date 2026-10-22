-- Rayat's reports for a term (Step 16): each upload of SS01, SF01 or SO01 with its diff, waiting,
-- applied or rolled back, and the records it keeps, never the file. Its inverse drops rayat_absences,
-- rayat_enrollments, rayat_sections and rayat_imports.
CREATE TABLE "rayat_absences" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"college_id" uuid NOT NULL,
	"import_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"subject_code" text NOT NULL,
	"course_number" text NOT NULL,
	"trainee_number" text NOT NULL,
	"course_status" text NOT NULL,
	"absence_percent" double precision,
	"absence_hours" double precision
);
--> statement-breakpoint
CREATE TABLE "rayat_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"college_id" uuid NOT NULL,
	"import_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"course_code" text NOT NULL,
	"section_ref" text NOT NULL,
	"trainee_number" text NOT NULL,
	"registration_status" text NOT NULL,
	"trainee_status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rayat_imports" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"college_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"mapping_version" integer NOT NULL,
	"row_count" integer NOT NULL,
	"record_count" integer NOT NULL,
	"diff" jsonb NOT NULL,
	"uploaded_by" uuid,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_by" uuid,
	"applied_at" timestamp with time zone,
	"rolled_back_by" uuid,
	"rolled_back_at" timestamp with time zone,
	CONSTRAINT "rayat_imports_college_id_id_unique" UNIQUE("college_id","id"),
	CONSTRAINT "rayat_imports_kind" CHECK ("rayat_imports"."kind" in ('ss01', 'sf01', 'so01')),
	CONSTRAINT "rayat_imports_status" CHECK ("rayat_imports"."status" in ('pending', 'applied', 'rolledBack'))
);
--> statement-breakpoint
CREATE TABLE "rayat_sections" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"college_id" uuid NOT NULL,
	"import_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"course_code" text NOT NULL,
	"course_name" text NOT NULL,
	"credit_hours" double precision,
	"section_ref" text NOT NULL,
	"delivery_mode" text NOT NULL,
	"capacity" integer NOT NULL,
	"enrolled" integer NOT NULL,
	"meetings" jsonb NOT NULL,
	"trainer_numbers" text[] NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rayat_absences" ADD CONSTRAINT "rayat_absences_import_fk" FOREIGN KEY ("college_id","import_id") REFERENCES "public"."rayat_imports"("college_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rayat_absences" ADD CONSTRAINT "rayat_absences_department_fk" FOREIGN KEY ("college_id","department_id") REFERENCES "public"."departments"("college_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rayat_enrollments" ADD CONSTRAINT "rayat_enrollments_import_fk" FOREIGN KEY ("college_id","import_id") REFERENCES "public"."rayat_imports"("college_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rayat_enrollments" ADD CONSTRAINT "rayat_enrollments_department_fk" FOREIGN KEY ("college_id","department_id") REFERENCES "public"."departments"("college_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rayat_imports" ADD CONSTRAINT "rayat_imports_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rayat_imports" ADD CONSTRAINT "rayat_imports_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rayat_imports" ADD CONSTRAINT "rayat_imports_applied_by_users_id_fk" FOREIGN KEY ("applied_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rayat_imports" ADD CONSTRAINT "rayat_imports_rolled_back_by_users_id_fk" FOREIGN KEY ("rolled_back_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rayat_imports" ADD CONSTRAINT "rayat_imports_term_fk" FOREIGN KEY ("college_id","term_id") REFERENCES "public"."terms"("college_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rayat_sections" ADD CONSTRAINT "rayat_sections_import_fk" FOREIGN KEY ("college_id","import_id") REFERENCES "public"."rayat_imports"("college_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rayat_sections" ADD CONSTRAINT "rayat_sections_department_fk" FOREIGN KEY ("college_id","department_id") REFERENCES "public"."departments"("college_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rayat_absences_import_id_idx" ON "rayat_absences" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "rayat_enrollments_import_id_idx" ON "rayat_enrollments" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "rayat_imports_term_kind_idx" ON "rayat_imports" USING btree ("term_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "rayat_imports_one_pending_idx" ON "rayat_imports" USING btree ("term_id","kind") WHERE "rayat_imports"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "rayat_sections_import_id_idx" ON "rayat_sections" USING btree ("import_id");