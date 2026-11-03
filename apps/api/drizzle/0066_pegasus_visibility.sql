-- Fork migration (PEGA-141): visibility pushed by the Pegasus Hub. IF NOT
-- EXISTS keeps it safe if upstream renumbering reruns it. Constraints sit
-- inside CREATE TABLE so a rerun never adds them twice.
ALTER TABLE "workspace_role" ADD COLUMN IF NOT EXISTS "hub_scoped" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pegasus_user_scope" (
	"workspace_id" text NOT NULL,
	"email" text NOT NULL,
	"mode" text NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "pegasus_user_scope_workspace_id_email_pk" PRIMARY KEY("workspace_id","email"),
	CONSTRAINT "pegasus_user_scope_mode_check" CHECK ("mode" in ('all', 'units', 'assigned')),
	CONSTRAINT "pegasus_user_scope_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pegasus_user_scope_unit" (
	"workspace_id" text NOT NULL,
	"email" text NOT NULL,
	"unit_id" text NOT NULL,
	CONSTRAINT "pegasus_user_scope_unit_workspace_id_email_unit_id_pk" PRIMARY KEY("workspace_id","email","unit_id"),
	CONSTRAINT "pegasus_user_scope_unit_scope_fk" FOREIGN KEY ("workspace_id","email") REFERENCES "public"."pegasus_user_scope"("workspace_id","email") ON DELETE cascade ON UPDATE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pegasus_task_unit" (
	"task_id" text PRIMARY KEY NOT NULL,
	"unit_id" text NOT NULL,
	CONSTRAINT "pegasus_task_unit_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pegasus_task_unit_unitId_idx" ON "pegasus_task_unit" USING btree ("unit_id");
