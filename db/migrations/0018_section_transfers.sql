CREATE TABLE "section_transfers" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"college_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"section_ref" text NOT NULL,
	"from_number" text NOT NULL,
	"to_user_id" uuid NOT NULL,
	"week" integer NOT NULL,
	"reason" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kept_at" timestamp with time zone,
	CONSTRAINT "section_transfers_week" CHECK ("section_transfers"."week" >= 1)
);
--> statement-breakpoint
ALTER TABLE "section_transfers" ADD CONSTRAINT "section_transfers_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "public"."colleges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_transfers" ADD CONSTRAINT "section_transfers_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_transfers" ADD CONSTRAINT "section_transfers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_transfers" ADD CONSTRAINT "section_transfers_term_fk" FOREIGN KEY ("college_id","term_id") REFERENCES "public"."terms"("college_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_transfers" ADD CONSTRAINT "section_transfers_department_fk" FOREIGN KEY ("college_id","department_id") REFERENCES "public"."departments"("college_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "section_transfers_term_idx" ON "section_transfers" USING btree ("term_id","section_ref");