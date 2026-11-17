ALTER TABLE "submissions" ADD COLUMN "mail_logged" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "login_attempts_ip_at" ON "login_attempts" USING btree ("ip","at");