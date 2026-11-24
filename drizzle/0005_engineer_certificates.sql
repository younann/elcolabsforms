CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"number" text,
	"issue_date" date NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pdf_key" text,
	"sent_to" text NOT NULL,
	"sent_at" timestamp with time zone,
	"status" text DEFAULT 'sending' NOT NULL,
	"error" text,
	"mail_logged" boolean DEFAULT false NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "certificates_submission_id_unique" UNIQUE("submission_id"),
	CONSTRAINT "certificates_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "needs_engineer" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "engineer_id" uuid;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "engineer_approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_engineer_id_users_id_fk" FOREIGN KEY ("engineer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;