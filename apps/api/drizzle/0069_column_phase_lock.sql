-- Fork migration (PEGA-170): a column's phase (the board groups neighbouring
-- columns of one phase under a heading) and its lock (members may not move
-- cards into or out of it). Existing columns stay without phase and unlocked.
-- IF NOT EXISTS keeps it safe if upstream renumbering reruns it.
ALTER TABLE "column" ADD COLUMN IF NOT EXISTS "phase" text;--> statement-breakpoint
ALTER TABLE "column" ADD COLUMN IF NOT EXISTS "is_locked" boolean DEFAULT false NOT NULL;
