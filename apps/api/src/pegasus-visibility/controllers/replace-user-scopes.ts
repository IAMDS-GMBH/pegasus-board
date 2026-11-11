import { eq } from "drizzle-orm";
import { lockWorkspace } from "../../admin/lock-workspace";
import db, { schema } from "../../database";
import { handleMemberAdded } from "../../workspace-members/handle-member-added";
import { addHubMembers } from "../add-hub-members";
import type { UserScopeInput } from "../schema";

// Postgres allows 65,535 bind parameters per statement; a unit row takes 3.
const UNIT_ROWS_PER_INSERT = 10_000;

// The Hub sends the full snapshot: a user it leaves out sees and does
// nothing. The first snapshot, even an empty one, hands the workspace to the
// Hub for good (PEGA-142). Listed users with an account join the workspace
// as members (PEGA-143, `add-hub-members.ts`).
async function replaceUserScopes(
  workspaceId: string,
  users: readonly UserScopeInput[],
) {
  const added = await db.transaction(async (tx) => {
    // First, so a concurrent push or sign-in waits here instead of
    // deadlocking on the membership insert.
    await lockWorkspace(tx, workspaceId);
    const updatedAt = new Date();
    await tx
      .insert(schema.pegasusWorkspaceTable)
      .values({ workspaceId, updatedAt })
      .onConflictDoUpdate({
        target: schema.pegasusWorkspaceTable.workspaceId,
        set: { updatedAt },
      });
    await tx
      .delete(schema.pegasusUserScopeTable)
      .where(eq(schema.pegasusUserScopeTable.workspaceId, workspaceId));
    if (users.length === 0) return [];

    await tx.insert(schema.pegasusUserScopeTable).values(
      users.map((user) => ({
        workspaceId,
        email: user.email,
        mode: user.mode,
        permissions: [...new Set(user.permissions)].sort(),
        updatedAt,
      })),
    );

    const units = users.flatMap((user) =>
      [...new Set(user.unitIds)].map((unitId) => ({
        workspaceId,
        email: user.email,
        unitId,
      })),
    );
    for (let start = 0; start < units.length; start += UNIT_ROWS_PER_INSERT) {
      await tx
        .insert(schema.pegasusUserScopeUnitTable)
        .values(units.slice(start, start + UNIT_ROWS_PER_INSERT));
    }
    return addHubMembers(tx, workspaceId);
  });

  for (const userId of added) await handleMemberAdded(workspaceId, userId);
  return { users: users.length };
}

export default replaceUserScopes;
