ALTER TABLE "client_sites" ADD COLUMN "form_ids" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "required_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL;