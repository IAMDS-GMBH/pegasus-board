import { and, eq, exists, type SQLWrapper, sql } from "drizzle-orm";
import db from "../database";
import { projectTable, taskTable, userTable } from "../database/schema";
import { projectAccessCondition } from "../project-access/project-access-condition";
import { loadTaskScopes } from "../task-scope/load-task-scopes";
import { statusChangesVisibleCondition } from "../task-scope/status-change-visible-condition";
import type { TaskScopes } from "../task-scope/task-scope";
import { tasksVisibleCondition } from "../task-scope/task-visible-condition";

// Membership, rather than public visibility or global admin privileges, defines
// who may be subscribed to private task activity. Use the same predicate when
// creating, reading and delivering notifications, including historical rows.
// Pegasus fork (PEGA-6, PEGA-141): `taskScopes` (from `loadTaskScopes(userId)`)
// also hides tasks outside a restricted role's scope. Required, so a new
// caller cannot forget it.
export function notificationResourceAccess(
  userId: string,
  resourceId: string | null | SQLWrapper,
  resourceType: string | null | SQLWrapper,
  taskScopes: TaskScopes,
) {
  const taskVisible =
    tasksVisibleCondition(taskScopes, {
      id: sql`notification_task.id`,
      assigneeId: sql`notification_task.assignee_id`,
      projectId: sql`notification_task.project_id`,
      status: sql`notification_task.status`,
      workspaceId: sql`notification_project.workspace_id`,
    }) ?? sql`true`;
  return sql<boolean>`(
    (${resourceId}::text IS NULL AND ${resourceType}::text IS NULL)
    OR (${resourceType}::text = 'task' AND EXISTS (
      SELECT 1 FROM task AS notification_task
      JOIN project AS notification_project ON notification_project.id = notification_task.project_id
      JOIN workspace_member AS notification_member ON notification_member.workspace_id = notification_project.workspace_id
      WHERE notification_task.id = ${resourceId} AND notification_member.user_id = ${userId}
        AND ${projectAccessCondition(userId, sql`notification_project.id`)}
        AND ${taskVisible}
    ))
    OR (${resourceType}::text = 'workspace' AND EXISTS (
      SELECT 1 FROM workspace_member AS notification_member
      WHERE notification_member.workspace_id = ${resourceId} AND notification_member.user_id = ${userId}
    ))
  )`;
}

export async function canReceiveResourceNotification(
  userId: string,
  resourceId?: string | null,
  resourceType?: string | null,
  database: Pick<typeof db, "select"> = db,
  // Pegasus fork (PEGA-170): a status change naming a restricted column does
  // not reach a recipient who does not see restricted columns.
  eventData?: unknown,
) {
  const taskScopes = await loadTaskScopes(userId);
  const statusVisible =
    resourceId && resourceType === "task" && eventData
      ? statusChangesVisibleCondition(taskScopes, {
          eventData: sql`${JSON.stringify(eventData)}::jsonb`,
          projectIds: [taskTable.projectId],
          workspaceId: projectTable.workspaceId,
        })
      : undefined;
  const [user] = await database
    .select({ id: userTable.id })
    .from(userTable)
    .where(
      and(
        eq(userTable.id, userId),
        notificationResourceAccess(
          userId,
          resourceId ?? null,
          resourceType ?? null,
          taskScopes,
        ),
        statusVisible &&
          exists(
            database
              .select({ one: sql`1` })
              .from(taskTable)
              .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
              .where(and(eq(taskTable.id, resourceId ?? ""), statusVisible)),
          ),
      ),
    )
    .limit(1);
  return Boolean(user);
}
