import { and, eq, notExists, sql } from "drizzle-orm";
import { lockWorkspace } from "../admin/lock-workspace";
import db, { schema } from "../database";
import { handleMemberAdded } from "../workspace-members/handle-member-added";
import { addHubMembers } from "./add-hub-members";

// Pegasus fork (PEGA-143): at sign-in and account creation, joins the user to
// every workspace whose Hub snapshot lists their verified email
// (`add-hub-members.ts`). The first query finds nothing for most sign-ins, so
// no lock is taken then.
export async function joinHubWorkspaces(userId: string): Promise<void> {
  const [user] = await db
    .select({
      email: schema.userTable.email,
      emailVerified: schema.userTable.emailVerified,
    })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId))
    .limit(1);
  if (!user?.emailVerified) return;

  const { pegasusUserScopeTable, workspaceUserTable } = schema;
  const listed = await db
    .select({ workspaceId: pegasusUserScopeTable.workspaceId })
    .from(pegasusUserScopeTable)
    .where(
      and(
        eq(pegasusUserScopeTable.email, user.email.toLowerCase()),
        notExists(
          db
            .select({ one: sql`1` })
            .from(workspaceUserTable)
            .where(
              and(
                eq(
                  workspaceUserTable.workspaceId,
                  pegasusUserScopeTable.workspaceId,
                ),
                eq(workspaceUserTable.userId, userId),
              ),
            ),
        ),
      ),
    );

  for (const { workspaceId } of listed) {
    const added = await db.transaction(async (tx) => {
      await lockWorkspace(tx, workspaceId);
      return addHubMembers(tx, workspaceId, userId);
    });
    if (added.length > 0) await handleMemberAdded(workspaceId, userId);
  }
}
