import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { ApiError } from "../../errors/api-error";
import { withLockedTask } from "./with-locked-task";
import { taskTable } from "../../database/schema";
import { publishTaskMutation } from "./task-mutation-effects";
import {
  assertAssignableUser,
  getProjectWorkspaceId,
} from "../../utils/assert-assignable-user";

async function updateTaskAssignee({
  id,
  userId,
  currentUserId,
  onlyIfAssignedTo,
}: {
  id: string;
  userId: string | null;
  currentUserId: string;
  // Pegasus fork (PEGA-143): change the task only while this user holds it,
  // checked under the row lock (`return-task.ts`).
  onlyIfAssignedTo?: string;
}) {
  const { before: existingTask, after: updatedTask } = await withLockedTask(
    id,
    async (tx, existingTask) => {
      if (
        onlyIfAssignedTo !== undefined &&
        existingTask.userId !== onlyIfAssignedTo
      ) {
        throw new ApiError(403, {
          message: "Only the task's assignee can do this",
          code: "NOT_TASK_ASSIGNEE",
        });
      }
      const nextAssigneeId = userId?.trim() || null;
      if (existingTask.userId === nextAssigneeId) {
        return existingTask;
      }

      if (nextAssigneeId) {
        await assertAssignableUser(
          nextAssigneeId,
          await getProjectWorkspaceId(existingTask.projectId, tx),
          existingTask.projectId,
          tx,
        );
      }

      const [updatedTask] = await tx
        .update(taskTable)
        .set({ userId: nextAssigneeId })
        .where(eq(taskTable.id, id))
        .returning();

      if (!updatedTask) {
        throw new HTTPException(500, {
          message: "Failed to update task assignee",
        });
      }

      return updatedTask;
    },
  );

  await publishTaskMutation(existingTask, updatedTask, currentUserId, {
    fields: ["userId"],
  });

  return updatedTask;
}

export default updateTaskAssignee;
