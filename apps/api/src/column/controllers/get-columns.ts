import { and, asc, eq } from "drizzle-orm";
import db from "../../database";
import { columnTable } from "../../database/schema";
import { columnVisibleCondition } from "../../task-scope/column-visible-condition";
import type { TaskScope } from "../../task-scope/task-scope";

// Pegasus fork (PEGA-170): `scope` hides restricted columns.
async function getColumns(projectId: string, scope: TaskScope | null = null) {
  const columns = await db
    .select()
    .from(columnTable)
    .where(
      and(eq(columnTable.projectId, projectId), columnVisibleCondition(scope)),
    )
    .orderBy(asc(columnTable.position));

  return columns;
}

export default getColumns;
