import { eq } from "drizzle-orm";
import db, { schema } from "../../database";
import type { UserScopeInput } from "../schema";

// Postgres allows 65,535 bind parameters per statement; a unit row takes 3.
const UNIT_ROWS_PER_INSERT = 10_000;

// The Hub sends the full snapshot: a user it leaves out sees nothing.
async function replaceUserScopes(
  workspaceId: string,
  users: readonly UserScopeInput[],
) {
  await db.transaction(async (tx) => {
    await tx
      .delete(schema.pegasusUserScopeTable)
      .where(eq(schema.pegasusUserScopeTable.workspaceId, workspaceId));
    if (users.length === 0) return;

    const updatedAt = new Date();
    await tx.insert(schema.pegasusUserScopeTable).values(
      users.map((user) => ({
        workspaceId,
        email: user.email,
        mode: user.mode,
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
  });

  return { users: users.length };
}

export default replaceUserScopes;
