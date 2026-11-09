import { and, eq, inArray, or } from "drizzle-orm";
import db, { schema } from "../database";
import { isOwnerRole } from "../project-access/is-owner-role";
import { hasInstanceAdminRole } from "../utils/instance-admin-role";
import { splitRoles } from "../utils/split-roles";
import { composeTaskScope } from "./compose-task-scope";
import type { HubMode, HubScope, TaskScope, TaskScopes } from "./task-scope";

// The restriction comes from the member's roles, never from API-key scopes,
// so a key can neither widen nor create it. Instance admins and owners are
// never restricted. A member with several comma-separated roles is
// restricted as soon as any role is, and duplicate unrestricted role rows
// cannot lift it.
export async function loadTaskScopes(
  userId: string,
  workspaceIds?: readonly string[],
): Promise<TaskScopes> {
  const scopes = new Map<string, TaskScope>();
  if (workspaceIds?.length === 0) return scopes;

  const [user] = await db
    .select({ role: schema.userTable.role, email: schema.userTable.email })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId))
    .limit(1);
  if (!user || hasInstanceAdminRole(user.role)) return scopes;

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
  if (memberships.length === 0) return scopes;

  const restrictedRoles = await db
    .select({
      workspaceId: schema.workspaceRoleTable.workspaceId,
      role: schema.workspaceRoleTable.role,
      assignedOnly: schema.workspaceRoleTable.assignedOnly,
      hubScoped: schema.workspaceRoleTable.hubScoped,
    })
    .from(schema.workspaceRoleTable)
    .where(
      and(
        inArray(
          schema.workspaceRoleTable.workspaceId,
          memberships.map((membership) => membership.workspaceId),
        ),
        or(
          eq(schema.workspaceRoleTable.assignedOnly, true),
          eq(schema.workspaceRoleTable.hubScoped, true),
        ),
      ),
    );
  if (restrictedRoles.length === 0) return scopes;

  const flags = memberships.map((membership) => {
    const roles = splitRoles(membership.role);
    const rows = restrictedRoles.filter(
      (row) =>
        row.workspaceId === membership.workspaceId && roles.includes(row.role),
    );
    return {
      workspaceId: membership.workspaceId,
      assignedOnly: rows.some((row) => row.assignedOnly),
      hubScoped: rows.some((row) => row.hubScoped),
    };
  });

  const hubScopes = await loadHubScopes(
    user.email.toLowerCase(),
    flags.filter((flag) => flag.hubScoped).map((flag) => flag.workspaceId),
  );

  for (const flag of flags) {
    const scope = composeTaskScope({
      userId,
      assignedOnly: flag.assignedOnly,
      hubScoped: flag.hubScoped,
      hub: hubScopes.get(flag.workspaceId) ?? null,
    });
    if (scope) scopes.set(flag.workspaceId, scope);
  }
  return scopes;
}

async function loadHubScopes(email: string, workspaceIds: string[]) {
  const scopes = new Map<string, HubScope>();
  if (workspaceIds.length === 0) return scopes;

  const rows = await db
    .select({
      workspaceId: schema.pegasusUserScopeTable.workspaceId,
      mode: schema.pegasusUserScopeTable.mode,
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

  for (const row of rows) {
    scopes.set(row.workspaceId, {
      mode: row.mode as HubMode,
      unitIds: units
        .filter((unit) => unit.workspaceId === row.workspaceId)
        .map((unit) => unit.unitId),
    });
  }
  return scopes;
}
