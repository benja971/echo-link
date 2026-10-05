CREATE TYPE "public"."upload_tier" AS ENUM('standard', 'trusted');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "upload_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"anonymous_ip_hash" text,
	"bytes" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "upload_reservations_bytes_nonnegative" CHECK ("upload_reservations"."bytes" >= 0),
	CONSTRAINT "upload_reservations_identity" CHECK (("upload_reservations"."account_id" is not null) <> ("upload_reservations"."anonymous_ip_hash" is not null))
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "upload_tier" "upload_tier" DEFAULT 'standard' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "upload_reservations" ADD CONSTRAINT "upload_reservations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "upload_reservations_account_idx" ON "upload_reservations" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "upload_reservations_expires_idx" ON "upload_reservations" USING btree ("expires_at");