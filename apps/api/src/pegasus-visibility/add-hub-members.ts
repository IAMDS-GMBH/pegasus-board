import { and, eq, notExists, sql } from "drizzle-orm";
import { isAssignableWorkspaceRole } from "../admin/is-assignable-workspace-role";
import { schema } from "../database";
import { clearMemberProjectAccess } from "../project-access/clear-member-project-access";
import type { DbOrTx } from "../project-access/db-or-tx";

// Pegasus fork (PEGA-143): someone the Hub lists in a workspace's snapshot is
// a member of it without an invitation, so a Führungskraft can assign them a
// card. Only accounts whose email is verified (Keycloak accounts are) count,
// so registering with someone else's address gains nothing. They join with the
// workspace's read-only role `pegasus` (docs/board-einrichtung.md): what they
// may do with leads comes from the Hub. A workspace without that role adds
// nobody rather than fall back to a role that can create projects and labels.
// Existing members are never touched and nobody is removed: a user the
// snapshot leaves out already sees and does nothing.
//
// The caller holds the workspace lock (`lockWorkspace`), so a concurrent add
// cannot insert the same membership twice. `userId` narrows it to one account.
export const HUB_MEMBER_ROLE = "pegasus";

export async function addHubMembers(
  tx: DbOrTx,
  workspaceId: string,
  userId?: string,
): Promise<string[]> {
  const { userTable, pegasusUserScopeTable, workspaceUserTable } = schema;
  const users = await tx
    .select({ id: userTable.id })
    .from(userTable)
    .innerJoin(
      pegasusUserScopeTable,
      and(
        eq(pegasusUserScopeTable.workspaceId, workspaceId),
        eq(pegasusUserScopeTable.email, sql`lower(${userTable.email})`),
      ),
    )
    .where(
      and(
        eq(userTable.emailVerified, true),
        userId ? eq(userTable.id, userId) : undefined,
        notExists(
          tx
            .select({ one: sql`1` })
            .from(workspaceUserTable)
            .where(
              and(
                eq(workspaceUserTable.workspaceId, workspaceId),
                eq(workspaceUserTable.userId, userTable.id),
              ),
            ),
        ),
      ),
    );
  if (users.length === 0) return [];
  if (!(await isAssignableWorkspaceRole(tx, workspaceId, HUB_MEMBER_ROLE))) {
    console.warn(
      `Workspace ${workspaceId} has no role "${HUB_MEMBER_ROLE}": ${users.length} user(s) of the Hub snapshot not added as members`,
    );
    return [];
  }

  const joinedAt = new Date();
  for (const user of users) {
    // Like an admin's add: project grants left from an earlier membership do
    // not come back.
    await clearMemberProjectAccess(workspaceId, user.id, tx);
  }
  await tx.insert(workspaceUserTable).values(
    users.map((user) => ({
      workspaceId,
      userId: user.id,
      role: HUB_MEMBER_ROLE,
      joinedAt,
    })),
  );
  return users.map((user) => user.id);
}
