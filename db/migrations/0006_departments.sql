CREATE TABLE "department_rayat_values" (
	"college_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "department_rayat_values_pkey" PRIMARY KEY("college_id","value")
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"college_id" uuid NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "departments_name_unique" UNIQUE("college_id","name"),
	CONSTRAINT "departments_short_name_unique" UNIQUE("college_id","short_name")
);
--> statement-breakpoint
ALTER TABLE "department_rayat_values" ADD CONSTRAINT "department_rayat_values_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_rayat_values" ADD CONSTRAINT "department_rayat_values_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "department_rayat_values_department_id_index" ON "department_rayat_values" USING btree ("department_id");