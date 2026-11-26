import { eq, type SQL } from "drizzle-orm";
import { columnTable } from "../database/schema";
import type { TaskScope } from "./task-scope";

/**
 * Pegasus fork (PEGA-170): the column is one the scope shows. `undefined`
 * when every column is visible, so it drops out of `and(...)`.
 */
export function columnVisibleCondition(
  scope: TaskScope | null,
  column: Pick<typeof columnTable, "isRestricted"> = columnTable,
): SQL | undefined {
  return scope?.hidesRestrictedColumns
    ? eq(column.isRestricted, false)
    : undefined;
}
