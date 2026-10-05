import { and, eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../database";
import { isInstanceAdmin } from "./is-instance-admin";

// Pegasus fork, Baustein 4: a workspace role may carry the restriction
// `task:view_assigned_only`, stored as `workspace_role.assigned_only`. Members
// with that role only see tasks assigned to themselves; every other task
// answers as if it did not exist (404).
//
// The flag lives outside the role's `permission` JSON because better-auth only
// lets a member grant permissions they hold, and nobody can hold a restriction
// without being restricted by it. The built-in `owner` role has no row and is
// never restricted. The restriction is never read from API-key scopes (a key
// cannot widen or narrow it) and never applies to instance admins, who also
// bypass workspace membership.

type AssignedOnlyScope = { userId: string | null };

const SCOPE_CONTEXT_KEY = "assignedOnlyScope";

/**
 * Returns the current user's id when their role in the request's workspace is
 * restricted to assigned tasks, otherwise `null`. Memoized on the context so a
 * middleware and a handler on the same request share one lookup.
 */
export async function resolveAssignedOnlyUserId(
  c: Context,
): Promise<string | null> {
  const cached = c.get(SCOPE_CONTEXT_KEY) as AssignedOnlyScope | undefined;
  if (cached) return cached.userId;

  const workspaceId = c.get("workspaceId") as string | undefined;
  if (!workspaceId) {
    throw new HTTPException(500, {
      message: "workspaceId not set in context",
    });
  }

  const userId = c.get("userId") as string | undefined;
  let restrictedUserId: string | null = null;

  if (userId && !(await isInstanceAdmin(c))) {
    const [row] = await db
      .select({ assignedOnly: schema.workspaceRoleTable.assignedOnly })
      .from(schema.workspaceUserTable)
      .leftJoin(
        schema.workspaceRoleTable,
        and(
          eq(schema.workspaceRoleTable.workspaceId, workspaceId),
          eq(schema.workspaceRoleTable.role, schema.workspaceUserTable.role),
        ),
      )
      .where(
        and(
          eq(schema.workspaceUserTable.userId, userId),
          eq(schema.workspaceUserTable.workspaceId, workspaceId),
        ),
      )
      .limit(1);

    if (row?.assignedOnly) {
      restrictedUserId = userId;
    }
  }

  c.set(SCOPE_CONTEXT_KEY, { userId: restrictedUserId });
  return restrictedUserId;
}

/**
 * Middleware for workspace-wide task views that cannot be narrowed to the
 * user's own tasks, such as integration sync scope. Runs after
 * `workspaceAccess`, which sets the workspace.
 */
export async function denyAssignedOnly(c: Context, next: Next) {
  if (await resolveAssignedOnlyUserId(c)) {
    throw new HTTPException(403, {
      message: "Not available to roles limited to assigned tasks",
    });
  }
  return next();
}

/**
 * Workspaces in which the current user is restricted to assigned tasks. Used
 * by reads that can span several workspaces (search).
 */
export async function listAssignedOnlyWorkspaceIds(
  c: Context,
): Promise<string[]> {
  const userId = c.get("userId") as string | undefined;
  if (!userId || (await isInstanceAdmin(c))) return [];

  const rows = await db
    .select({
      workspaceId: schema.workspaceUserTable.workspaceId,
      assignedOnly: schema.workspaceRoleTable.assignedOnly,
    })
    .from(schema.workspaceUserTable)
    .leftJoin(
      schema.workspaceRoleTable,
      and(
        eq(
          schema.workspaceRoleTable.workspaceId,
          schema.workspaceUserTable.workspaceId,
        ),
        eq(schema.workspaceRoleTable.role, schema.workspaceUserTable.role),
      ),
    )
    .where(eq(schema.workspaceUserTable.userId, userId));

  return rows.filter((row) => row.assignedOnly).map((row) => row.workspaceId);
}

/**
 * Throws 404 when a restricted user touches a task that is not assigned to
 * them. Unassigned tasks (`null`) are hidden as well. No-op when unrestricted.
 */
export function assertTasksVisible(
  assignees: ReadonlyArray<string | null>,
  restrictToUserId: string | null,
): void {
  if (!restrictToUserId) return;
  if (assignees.every((assignee) => assignee === restrictToUserId)) return;
  throw new HTTPException(404, {
    message: assignees.length > 1 ? "No tasks found" : "Task not found",
  });
}
