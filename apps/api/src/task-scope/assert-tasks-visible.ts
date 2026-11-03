import { and, inArray } from "drizzle-orm";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../database";
import { resolveTaskScope } from "./resolve-task-scope";
import { taskVisibleCondition } from "./task-visible-condition";

/**
 * Throws 404 when the request's user may not see one of the given (existing)
 * tasks. A hidden task answers as if it did not exist. No query for
 * unrestricted users.
 */
export async function assertTasksVisible(
  c: Context,
  taskIds: readonly string[],
): Promise<void> {
  const ids = [...new Set(taskIds)];
  if (ids.length === 0) return;
  const scope = await resolveTaskScope(c);
  if (!scope) return;

  const visible = await db
    .select({ id: schema.taskTable.id })
    .from(schema.taskTable)
    .where(and(inArray(schema.taskTable.id, ids), taskVisibleCondition(scope)));
  if (visible.length === ids.length) return;
  throw new HTTPException(404, {
    message: ids.length > 1 ? "No tasks found" : "Task not found",
  });
}
