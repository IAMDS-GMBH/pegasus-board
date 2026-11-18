-- Fork migration (PEGA-123): field groups and fields owned by the Pegasus Hub.
-- IF NOT EXISTS keeps it safe if upstream renumbering reruns it.
ALTER TABLE "custom_field_definition" ADD COLUMN IF NOT EXISTS "section" text;--> statement-breakpoint
ALTER TABLE "custom_field_definition" ADD COLUMN IF NOT EXISTS "hub_defined" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_field_definition" ADD COLUMN IF NOT EXISTS "hub_managed" boolean DEFAULT false NOT NULL;
