import { and, eq, inArray, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";

// Tasks not listed keep their unit. One unknown or foreign task rejects the
// whole request so the Hub never half-applies a reconciliation.
async function setTaskUnits(
  workspaceId: string,
  tasks: ReadonlyArray<{ taskId: string; unitId: string }>,
) {
  if (tasks.length === 0) return { tasks: 0 };

  return db.transaction(async (tx) => {
    const ids = tasks.map((task) => task.taskId);
    const found = await tx
      .select({ id: schema.taskTable.id })
      .from(schema.taskTable)
      .innerJoin(
        schema.projectTable,
        eq(schema.taskTable.projectId, schema.projectTable.id),
      )
      .where(
        and(
          inArray(schema.taskTable.id, ids),
          eq(schema.projectTable.workspaceId, workspaceId),
        ),
      );
    const foundIds = new Set(found.map((task) => task.id));
    const missing = ids.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new HTTPException(400, {
        message: `Tasks not found in this workspace: ${missing.join(", ")}`,
      });
    }

    await tx
      .insert(schema.pegasusTaskUnitTable)
      .values([...tasks])
      .onConflictDoUpdate({
        target: schema.pegasusTaskUnitTable.taskId,
        set: { unitId: sql`excluded.unit_id` },
      });
    return { tasks: tasks.length };
  });
}

export default setTaskUnits;
