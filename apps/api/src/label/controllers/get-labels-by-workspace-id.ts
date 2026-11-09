import { and, eq, exists, isNull, or } from "drizzle-orm";
import db from "../../database";
import { labelTable, taskTable } from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import type { TaskScope } from "../../task-scope/task-scope";
import { taskVisibleCondition } from "../../task-scope/task-visible-condition";

function getLabelsByWorkspaceId(
  workspaceId: string,
  userId: string,
  scope: TaskScope | null = null, // Pegasus fork (PEGA-141)
) {
  return db
    .select()
    .from(labelTable)
    .where(
      and(
        eq(labelTable.workspaceId, workspaceId),
        or(
          isNull(labelTable.taskId),
          exists(
            db
              .select({ id: taskTable.id })
              .from(taskTable)
              .where(
                and(
                  eq(taskTable.id, labelTable.taskId),
                  projectAccessCondition(userId, taskTable.projectId),
                  taskVisibleCondition(scope),
                ),
              ),
          ),
        ),
      ),
    );
}

export default getLabelsByWorkspaceId;
