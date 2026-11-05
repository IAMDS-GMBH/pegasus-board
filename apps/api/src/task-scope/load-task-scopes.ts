import { and, eq, inArray } from "drizzle-orm";
import db, { schema } from "../database";
import { isOwnerRole } from "../project-access/is-owner-role";
import { hasInstanceAdminRole } from "../utils/instance-admin-role";
import { splitRoles } from "../utils/split-roles";
import { composeTaskScope } from "./compose-task-scope";
import { isHubSystemAccount } from "./is-hub-system-account";
import type { HubMode, HubScope, TaskScope, TaskScopes } from "./task-scope";

// What a member may see and, in a workspace the Hub manages, do. `scope: null`
// sees everything; `permissions: null` is not governed by Hub rights.
export type MemberAccess = {
  scope: TaskScope | null;
  permissions: ReadonlySet<string> | null;
};

type HubRow = HubScope & { permissions: readonly string[] };

// Restrictions come from the member's roles and the Hub's snapshot, never
// from API-key scopes, so a key can neither widen nor create them. Instance
// admins, owners and the Hub's system account are never restricted. Holds
// only workspaces where the user is restricted in some way.
export async function loadMemberAccess(
  userId: string,
  workspaceIds?: readonly string[],
): Promise<Map<string, MemberAccess>> {
  const access = new Map<string, MemberAccess>();
  if (workspaceIds?.length === 0) return access;

  const [user] = await db
    .select({ role: schema.userTable.role, email: schema.userTable.email })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId))
    .limit(1);
  if (
    !user ||
    hasInstanceAdminRole(user.role) ||
    isHubSystemAccount(user.email)
  ) {
    return access;
  }

  const memberships = (
    await db
      .select({
        workspaceId: schema.workspaceUserTable.workspaceId,
        role: schema.workspaceUserTable.role,
      })
      .from(schema.workspaceUserTable)
      .where(
        and(
          eq(schema.workspaceUserTable.userId, userId),
          workspaceIds
            ? inArray(schema.workspaceUserTable.workspaceId, [...workspaceIds])
            : undefined,
        ),
      )
  ).filter((membership) => !isOwnerRole(membership.role));
  if (memberships.length === 0) return access;
  const memberWorkspaceIds = memberships.map((m) => m.workspaceId);

  const assignedOnlyRoles = await db
    .select({
      workspaceId: schema.workspaceRoleTable.workspaceId,
      role: schema.workspaceRoleTable.role,
    })
    .from(schema.workspaceRoleTable)
    .where(
      and(
        inArray(schema.workspaceRoleTable.workspaceId, memberWorkspaceIds),
        eq(schema.workspaceRoleTable.assignedOnly, true),
      ),
    );
  const managed = new Set(
    (
      await db
        .select({ workspaceId: schema.pegasusWorkspaceTable.workspaceId })
        .from(schema.pegasusWorkspaceTable)
        .where(
          inArray(schema.pegasusWorkspaceTable.workspaceId, memberWorkspaceIds),
        )
    ).map((row) => row.workspaceId),
  );
  const hubRows = await loadHubRows(user.email.toLowerCase(), [...managed]);

  for (const membership of memberships) {
    const roles = splitRoles(membership.role);
    const isManaged = managed.has(membership.workspaceId);
    const hub = hubRows.get(membership.workspaceId) ?? null;
    const scope = composeTaskScope({
      userId,
      // A member with several roles is restricted as soon as any role is.
      assignedOnly: assignedOnlyRoles.some(
        (row) =>
          row.workspaceId === membership.workspaceId &&
          roles.includes(row.role),
      ),
      managed: isManaged,
      hub,
    });
    const permissions = isManaged ? new Set(hub?.permissions ?? []) : null;
    if (scope || permissions) {
      access.set(membership.workspaceId, { scope, permissions });
    }
  }
  return access;
}

export async function loadTaskScopes(
  userId: string,
  workspaceIds?: readonly string[],
): Promise<TaskScopes> {
  const scopes = new Map<string, TaskScope>();
  for (const [workspaceId, { scope }] of await loadMemberAccess(
    userId,
    workspaceIds,
  )) {
    if (scope) scopes.set(workspaceId, scope);
  }
  return scopes;
}

async function loadHubRows(email: string, workspaceIds: string[]) {
  const rows = new Map<string, HubRow>();
  if (workspaceIds.length === 0) return rows;

  const scopes = await db
    .select({
      workspaceId: schema.pegasusUserScopeTable.workspaceId,
      mode: schema.pegasusUserScopeTable.mode,
      permissions: schema.pegasusUserScopeTable.permissions,
    })
    .from(schema.pegasusUserScopeTable)
    .where(
      and(
        eq(schema.pegasusUserScopeTable.email, email),
        inArray(schema.pegasusUserScopeTable.workspaceId, workspaceIds),
      ),
    );
  const units = await db
    .select({
      workspaceId: schema.pegasusUserScopeUnitTable.workspaceId,
      unitId: schema.pegasusUserScopeUnitTable.unitId,
    })
    .from(schema.pegasusUserScopeUnitTable)
    .where(
      and(
        eq(schema.pegasusUserScopeUnitTable.email, email),
        inArray(schema.pegasusUserScopeUnitTable.workspaceId, workspaceIds),
      ),
    );

  for (const row of scopes) {
    rows.set(row.workspaceId, {
      mode: row.mode as HubMode,
      permissions: row.permissions,
      unitIds: units
        .filter((unit) => unit.workspaceId === row.workspaceId)
        .map((unit) => unit.unitId),
    });
  }
  return rows;
}
