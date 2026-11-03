import { eq } from "drizzle-orm";
import db, { schema } from "../../database";

async function setTaskUnit(taskId: string, unitId: string | null) {
  if (unitId === null) {
    await db
      .delete(schema.pegasusTaskUnitTable)
      .where(eq(schema.pegasusTaskUnitTable.taskId, taskId));
  } else {
    await db
      .insert(schema.pegasusTaskUnitTable)
      .values({ taskId, unitId })
      .onConflictDoUpdate({
        target: schema.pegasusTaskUnitTable.taskId,
        set: { unitId },
      });
  }
  return { taskId, unitId };
}

export default setTaskUnit;
