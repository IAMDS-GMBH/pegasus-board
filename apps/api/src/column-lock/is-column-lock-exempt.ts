import { and, eq } from "drizzle-orm";
import db from "../database";
import { userTable, workspaceUserTable } from "../database/schema";
import { isOwnerRole } from "../project-access/is-owner-role";
import { isHubSystemAccount } from "../task-scope/is-hub-system-account";
import { hasInstanceAdminRole } from "../utils/instance-admin-role";

// Pegasus fork (PEGA-170): the same accounts the Hub's rights never govern
// (PEGA-142) may move cards through locked columns. Unlike `loadMemberAccess`,
// this holds in every workspace, not only those the Hub manages.
export async function isColumnLockExempt(
  userId: string | undefined,
  workspaceId: string | undefined,
): Promise<boolean> {
  if (!userId) return false;
  if (isHubSystemAccount(userId)) return true;

  const [row] = await db
    .select({ userRole: userTable.role, memberRole: workspaceUserTable.role })
    .from(userTable)
    .leftJoin(
      workspaceUserTable,
      and(
        eq(workspaceUserTable.userId, userTable.id),
        eq(workspaceUserTable.workspaceId, workspaceId ?? ""),
      ),
    )
    .where(eq(userTable.id, userId))
    .limit(1);

  return hasInstanceAdminRole(row?.userRole) || isOwnerRole(row?.memberRole);
}
