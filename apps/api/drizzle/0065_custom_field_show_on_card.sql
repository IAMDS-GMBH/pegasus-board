-- Fork migration (PEGA-88): admins choose which custom fields show on the
-- board card. IF NOT EXISTS keeps it safe if upstream renumbering reruns it.
ALTER TABLE "custom_field_definition" ADD COLUMN IF NOT EXISTS "show_on_card" boolean DEFAULT false NOT NULL;
