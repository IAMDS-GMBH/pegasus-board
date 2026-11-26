import { and, desc, eq } from "drizzle-orm";
import db from "../../database";
import {
  notificationTable,
  projectTable,
  taskTable,
  workspaceTable,
} from "../../database/schema";

import { loadTaskScopes } from "../../task-scope/load-task-scopes";
import { statusChangesVisibleCondition } from "../../task-scope/status-change-visible-condition";
import { notificationResourceAccess } from "../resource-access";
import { notificationWorkspaceFilter } from "../workspace-filter";

async function getNotifications(userId: string, workspaceId?: string) {
  const taskScopes = await loadTaskScopes(userId);
  const rows = await db
    .select({
      notification: notificationTable,
      projectId: projectTable.id,
      workspaceId: workspaceTable.id,
    })
    .from(notificationTable)
    .leftJoin(
      taskTable,
      and(
        eq(notificationTable.resourceId, taskTable.id),
        eq(notificationTable.resourceType, "task"),
      ),
    )
    .leftJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .leftJoin(workspaceTable, eq(projectTable.workspaceId, workspaceTable.id))
    .where(
      and(
        eq(notificationTable.userId, userId),
        notificationWorkspaceFilter(workspaceId),
        notificationResourceAccess(
          userId,
          notificationTable.resourceId,
          notificationTable.resourceType,
          taskScopes,
        ),
        // Pegasus fork (PEGA-170): also rows from before the restriction.
        statusChangesVisibleCondition(taskScopes, {
          eventData: notificationTable.eventData,
          projectIds: [taskTable.projectId],
          workspaceId: projectTable.workspaceId,
        }),
      ),
    )
    .orderBy(desc(notificationTable.createdAt))
    .limit(50);

  return rows.map(({ notification, projectId, workspaceId }) => {
    if (!projectId && !workspaceId) {
      return notification;
    }

    const existing =
      notification.eventData &&
      typeof notification.eventData === "object" &&
      !Array.isArray(notification.eventData)
        ? (notification.eventData as Record<string, unknown>)
        : {};

    return {
      ...notification,
      eventData: {
        ...existing,
        projectId: projectId ?? existing.projectId ?? null,
        workspaceId: workspaceId ?? existing.workspaceId ?? null,
      },
    };
  });
}

export default getNotifications;
