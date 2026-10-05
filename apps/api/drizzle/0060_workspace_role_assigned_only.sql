-- Fork migration, first shipped as 0055 before the upstream sync renumbered it.
-- IF NOT EXISTS keeps it safe on databases that already ran the old 0055.
ALTER TABLE "workspace_role" ADD COLUMN IF NOT EXISTS "assigned_only" boolean DEFAULT false NOT NULL;
