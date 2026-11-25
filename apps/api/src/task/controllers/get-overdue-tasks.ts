import { and, asc, count, eq, isNull, lt, ne, sql } from "drizzle-orm";
import db from "../../database";
import {
  columnTable,
  projectTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import type { TaskScope } from "../../task-scope/task-scope";
import { taskVisibleCondition } from "../../task-scope/task-visible-condition";
import { taskIsCompleted } from "../task-is-completed";

// Pegasus fork (PEGA-66): the Hub sets a lead's deadline as its due date. A
// card is overdue once that moment has passed, while it sits in a column that
// is not final and is not archived. Home renders the list whole, so it stays
// one bounded page.
export const OVERDUE_TASKS_LIMIT = 100;

async function getOverdueTasks(
  workspaceId: string,
  userId: string,
  scope: TaskScope | null,
  countOnly = false,
) {
  const overdueAndVisible = and(
    eq(projectTable.workspaceId, workspaceId),
    isNull(projectTable.archivedAt),
    ne(taskTable.status, "archived"),
    lt(taskTable.dueDate, sql`now()`),
    sql`not coalesce((
      select ${columnTable.isFinal} from ${columnTable}
      where ${columnTable.id} = ${taskTable.columnId}
        and ${columnTable.projectId} = ${taskTable.projectId}
    ), ${taskIsCompleted})`,
    projectAccessCondition(userId, projectTable.id),
    taskVisibleCondition(scope),
  );

  const totalsQuery = db
    .select({ total: count() })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(overdueAndVisible);

  if (countOnly) {
    const [totals] = await totalsQuery;
    return { tasks: [], total: Number(totals?.total ?? 0) };
  }

  // Duplicate slugs from concurrent column creation may exist; the lateral
  // lookup prefers the task's own column and returns one name per task.
  const statusColumn = db
    .select({ name: columnTable.name })
    .from(columnTable)
    .where(
      and(
        eq(columnTable.projectId, taskTable.projectId),
        eq(columnTable.slug, taskTable.status),
      ),
    )
    .orderBy(
      sql`case when ${columnTable.id} = ${taskTable.columnId} then 0 else 1 end`,
      asc(columnTable.position),
      asc(columnTable.id),
    )
    .limit(1)
    .as("overdue_status_column");

  const [tasks, [totals]] = await Promise.all([
    db
      .select({
        id: taskTable.id,
        projectId: taskTable.projectId,
        number: taskTable.number,
        title: taskTable.title,
        status: taskTable.status,
        statusName: statusColumn.name,
        // Never null here: the condition requires a due date in the past.
        dueDate: sql<Date>`${taskTable.dueDate}`.mapWith(taskTable.dueDate),
        assigneeId: taskTable.userId,
        assigneeName: userTable.name,
        projectName: projectTable.name,
        projectSlug: projectTable.slug,
      })
      .from(taskTable)
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .leftJoin(userTable, eq(taskTable.userId, userTable.id))
      .leftJoinLateral(statusColumn, sql`true`)
      .where(overdueAndVisible)
      .orderBy(asc(taskTable.dueDate), asc(taskTable.id))
      .limit(OVERDUE_TASKS_LIMIT),
    totalsQuery,
  ]);

  return { tasks, total: Number(totals?.total ?? 0) };
}

export default getOverdueTasks;
