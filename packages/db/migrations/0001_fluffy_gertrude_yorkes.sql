ALTER TABLE "files" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_slug_unique" UNIQUE("slug");