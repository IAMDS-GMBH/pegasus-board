-- Fork migration, first shipped as 0055 and then 0060 before upstream syncs
-- renumbered it. IF NOT EXISTS keeps it safe on databases that already ran it.
ALTER TABLE "workspace_role" ADD COLUMN IF NOT EXISTS "assigned_only" boolean DEFAULT false NOT NULL;
