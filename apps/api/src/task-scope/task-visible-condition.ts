import {
  and,
  inArray,
  notInArray,
  or,
  type SQL,
  type SQLWrapper,
  sql,
} from "drizzle-orm";
import {
  pegasusTaskUnitTable,
  projectTable,
  taskTable,
} from "../database/schema";
import type { TaskScope, TaskScopes } from "./task-scope";

// Only builds SQL: no database handle, so modules that import it stay usable
// in unit tests that mock `../database`.

type TaskColumns = { id: SQLWrapper; assigneeId: SQLWrapper };

const taskColumns: TaskColumns = {
  id: taskTable.id,
  assigneeId: taskTable.userId,
};

/**
 * The single predicate for "this task is visible in the scope". `undefined`
 * for an unrestricted user, so it drops out of `and(...)` at no cost. The
 * columns may be SQL references, for queries over an aliased task table.
 */
export function taskVisibleCondition(
  scope: TaskScope | null,
  task: TaskColumns = taskColumns,
): SQL | undefined {
  if (!scope) return undefined;
  if (scope.unitIds?.length === 0) return sql`false`;

  return and(
    scope.assignedOnly ? sql`${task.assigneeId} = ${scope.userId}` : undefined,
    scope.unitIds
      ? sql`exists (select 1 from ${pegasusTaskUnitTable} where ${pegasusTaskUnitTable.taskId} = ${task.id} and ${inArray(pegasusTaskUnitTable.unitId, [...scope.unitIds])})`
      : undefined,
  );
}

/**
 * The same predicate for reads that span workspaces: a task is visible when
 * its workspace does not restrict the user or the workspace's scope admits it.
 */
export function tasksVisibleCondition(
  scopes: TaskScopes,
  task: TaskColumns & { workspaceId: SQLWrapper } = {
    ...taskColumns,
    workspaceId: projectTable.workspaceId,
  },
): SQL | undefined {
  if (scopes.size === 0) return undefined;

  return or(
    notInArray(sql`${task.workspaceId}`, [...scopes.keys()]),
    ...[...scopes].map(([workspaceId, scope]) =>
      and(
        sql`${task.workspaceId} = ${workspaceId}`,
        taskVisibleCondition(scope, task),
      ),
    ),
  );
}
