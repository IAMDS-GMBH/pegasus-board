import { and, eq, inArray } from "drizzle-orm";
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../database";
import { isOwnerRole } from "../project-access/is-owner-role";
import { isInstanceAdmin } from "./is-instance-admin";
import { splitRoles } from "./split-roles";

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
//
// A member can hold several comma-separated roles (upstream `splitRoles`). The
// restriction applies as soon as any of them is restricted, unless one of
// them is `owner`.

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
    const [member] = await db
      .select({ role: schema.workspaceUserTable.role })
      .from(schema.workspaceUserTable)
      .where(
        and(
          eq(schema.workspaceUserTable.userId, userId),
          eq(schema.workspaceUserTable.workspaceId, workspaceId),
        ),
      )
      .limit(1);

    const restricted = await findRestrictedWorkspaceIds([
      { workspaceId, role: member?.role },
    ]);
    if (restricted.length > 0) {
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

  const memberships = await db
    .select({
      workspaceId: schema.workspaceUserTable.workspaceId,
      role: schema.workspaceUserTable.role,
    })
    .from(schema.workspaceUserTable)
    .where(eq(schema.workspaceUserTable.userId, userId));

  return findRestrictedWorkspaceIds(memberships);
}

/**
 * Workspaces among the given memberships where any of the member's roles is
 * restricted. Duplicate role rows cannot lift the restriction: one restricted
 * row is enough.
 */
async function findRestrictedWorkspaceIds(
  memberships: ReadonlyArray<{
    workspaceId: string;
    role: string | null | undefined;
  }>,
): Promise<string[]> {
  const candidates = memberships
    .filter((membership) => !isOwnerRole(membership.role))
    .map((membership) => ({
      workspaceId: membership.workspaceId,
      roles: splitRoles(membership.role),
    }))
    .filter((membership) => membership.roles.length > 0);
  if (candidates.length === 0) return [];

  const restrictedRoles = await db
    .select({
      workspaceId: schema.workspaceRoleTable.workspaceId,
      role: schema.workspaceRoleTable.role,
    })
    .from(schema.workspaceRoleTable)
    .where(
      and(
        inArray(
          schema.workspaceRoleTable.workspaceId,
          candidates.map((membership) => membership.workspaceId),
        ),
        eq(schema.workspaceRoleTable.assignedOnly, true),
      ),
    );

  return candidates
    .filter((membership) =>
      restrictedRoles.some(
        (row) =>
          row.workspaceId === membership.workspaceId &&
          membership.roles.includes(row.role),
      ),
    )
    .map((membership) => membership.workspaceId);
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
