import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

// Pegasus fork (PEGA-142): workspaces the Hub scoped under PEGA-141 must stay
// governed after the upgrade instead of opening up until the next push.
const migration = readFileSync(
  new URL(
    "../../apps/api/drizzle/0067_pegasus_permissions.sql",
    import.meta.url,
  ),
  "utf8",
);

async function managedWorkspaces() {
  return (
    await db
      .select({ workspaceId: schema.pegasusWorkspaceTable.workspaceId })
      .from(schema.pegasusWorkspaceTable)
  )
    .map((row) => row.workspaceId)
    .sort();
}

describe("migration 0067: pegasus permissions", () => {
  beforeEach(resetTestDatabase);

  it("marks workspaces with pushed scopes as managed, once", async () => {
    const scoped = await createWorkspaceMember();
    const untouched = await createWorkspaceMember();
    await db.insert(schema.pegasusUserScopeTable).values([
      { workspaceId: scoped.workspace.id, email: "a@wwk.test", mode: "all" },
      { workspaceId: scoped.workspace.id, email: "b@wwk.test", mode: "all" },
    ]);

    await db.execute(sql.raw(migration));
    expect(await managedWorkspaces()).toEqual([scoped.workspace.id]);

    await db.execute(sql.raw(migration));
    expect(await managedWorkspaces()).toEqual([scoped.workspace.id]);
    expect(await managedWorkspaces()).not.toContain(untouched.workspace.id);
  });
});
