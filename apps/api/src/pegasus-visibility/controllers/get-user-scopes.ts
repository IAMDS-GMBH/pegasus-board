import { asc, eq } from "drizzle-orm";
import db, { schema } from "../../database";

async function getUserScopes(workspaceId: string) {
  const scopes = await db
    .select()
    .from(schema.pegasusUserScopeTable)
    .where(eq(schema.pegasusUserScopeTable.workspaceId, workspaceId))
    .orderBy(asc(schema.pegasusUserScopeTable.email));
  const units = await db
    .select()
    .from(schema.pegasusUserScopeUnitTable)
    .where(eq(schema.pegasusUserScopeUnitTable.workspaceId, workspaceId))
    .orderBy(asc(schema.pegasusUserScopeUnitTable.unitId));

  return {
    users: scopes.map((scope) => ({
      email: scope.email,
      mode: scope.mode,
      unitIds: units
        .filter((unit) => unit.email === scope.email)
        .map((unit) => unit.unitId),
      permissions: scope.permissions,
      updatedAt: scope.updatedAt,
    })),
  };
}

export default getUserScopes;
