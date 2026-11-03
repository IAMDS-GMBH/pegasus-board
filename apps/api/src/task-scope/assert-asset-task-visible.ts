import { and, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../database";
import { loadTaskScopes } from "./load-task-scopes";
import { taskVisibleCondition } from "./task-visible-condition";

/**
 * Throws 404 when the asset belongs to a task (directly, or through the
 * comment it is attached to) that the user may not see. Assets without a
 * task, and unrestricted users, pass.
 */
export async function assertAssetTaskVisible(
  userId: string,
  asset: { id: string; workspaceId: string },
): Promise<void> {
  const scope =
    (await loadTaskScopes(userId, [asset.workspaceId])).get(
      asset.workspaceId,
    ) ?? null;
  if (!scope) return;

  const [row] = await db
    .select({
      taskId: sql<
        string | null
      >`coalesce(${schema.assetTable.taskId}, ${schema.activityTable.taskId})`,
    })
    .from(schema.assetTable)
    .leftJoin(
      schema.activityTable,
      eq(schema.assetTable.activityId, schema.activityTable.id),
    )
    .where(eq(schema.assetTable.id, asset.id))
    .limit(1);
  if (!row?.taskId) return;

  const [visible] = await db
    .select({ id: schema.taskTable.id })
    .from(schema.taskTable)
    .where(
      and(eq(schema.taskTable.id, row.taskId), taskVisibleCondition(scope)),
    )
    .limit(1);
  if (!visible) throw new HTTPException(404, { message: "Asset not found" });
}
