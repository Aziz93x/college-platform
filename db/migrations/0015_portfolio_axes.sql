-- The portfolio's axes (Step 14): the administration's catalog, in groups, seeded by the base seed;
-- the admin corrects an axis's title and description. Its inverse drops axes, then axis_groups.
CREATE TABLE "axes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"college_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "axes_code_unique" UNIQUE("college_id","code")
);
--> statement-breakpoint
CREATE TABLE "axis_groups" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"college_id" uuid NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "axis_groups_college_id_id_unique" UNIQUE("college_id","id"),
	CONSTRAINT "axis_groups_code_unique" UNIQUE("college_id","code")
);
--> statement-breakpoint
ALTER TABLE "axes" ADD CONSTRAINT "axes_group_fk" FOREIGN KEY ("college_id","group_id") REFERENCES "public"."axis_groups"("college_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "axis_groups" ADD CONSTRAINT "axis_groups_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE no action ON UPDATE no action;