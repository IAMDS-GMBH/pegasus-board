-- Fork migration (PEGA-142): rights per user pushed by the Pegasus Hub, and the
-- marker for workspaces the Hub manages. The role switch `hub_scoped` (PEGA-141)
-- gives way to that marker. IF [NOT] EXISTS keeps it safe if upstream
-- renumbering reruns it; constraints sit inside CREATE TABLE for the same reason.
CREATE TABLE IF NOT EXISTS "pegasus_workspace" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "pegasus_workspace_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade
);
--> statement-breakpoint
ALTER TABLE "pegasus_user_scope" ADD COLUMN IF NOT EXISTS "permissions" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
-- Workspaces the Hub already scoped (PEGA-141) stay governed instead of falling
-- open until its next push. Their stored rows carry no rights yet, so members
-- only read until the Hub pushes again (fail closed).
INSERT INTO "pegasus_workspace" ("workspace_id")
SELECT DISTINCT "workspace_id" FROM "pegasus_user_scope"
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "workspace_role" DROP COLUMN IF EXISTS "hub_scoped";
