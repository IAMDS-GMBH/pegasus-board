import { and, desc, eq, sql } from "drizzle-orm";
import db from "../../database";
import { activityTable } from "../../database/schema";
import { statusChangeVisibleCondition } from "../../task-scope/status-change-visible-condition";
import type { TaskScope } from "../../task-scope/task-scope";
import { redactInaccessibleMoves } from "../redact-inaccessible-moves";

async function getActivitiesFromTaskId(
  taskId: string,
  viewerId: string,
  limit?: number,
  // Pegasus fork (PEGA-170): hides moves through restricted columns.
  scope: TaskScope | null = null,
) {
  // The callback form refers to the aliased table the relational query reads.
  const activities = await db.query.activityTable.findMany({
    where: (activity) =>
      and(
        eq(activity.taskId, taskId),
        statusChangeVisibleCondition(scope, {
          eventData: activity.eventData,
          projectIds: [
            // Plain names: the relational query would alias task columns too.
            sql`(select history_task.project_id from task as history_task where history_task.id = ${taskId})`,
            sql`${activity.eventData}->>'fromProjectId'`,
          ],
        }),
      ),
    orderBy: [desc(activityTable.createdAt), desc(activityTable.id)],
    limit,
  });

  activities.forEach((x) => {
    if (x.content && x.type !== "comment") {
      x.content = x.content.replace(/\n+/g, "\n");
    }
  });

  return redactInaccessibleMoves(viewerId, activities);
}

export default getActivitiesFromTaskId;
