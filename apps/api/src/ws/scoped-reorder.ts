import { and, inArray } from "drizzle-orm";
import db from "../database";
import { taskTable } from "../database/schema";
import { loadTaskScopes } from "../task-scope/load-task-scopes";
import { taskVisibleCondition } from "../task-scope/task-visible-condition";
import type { ProjectBroadcastMessage } from "./broadcast-adapter";

// Pegasus fork (PEGA-141, PEGA-170): a reorder carries the status and position
// of every task it moved. A recipient whose scope hides one of them gets a
// plain PROJECT_UPDATED instead, so the board refetches through the scoped
// endpoint (which also drops a card that just moved out of sight). Returns
// the payload to send per user; users missing from the map get the original.
export async function scopedReorderPayloads(
  workspaceId: string,
  userIds: readonly string[],
  message: ProjectBroadcastMessage,
): Promise<Map<string, string>> {
  const payloads = new Map<string, string>();
  const ids = [...new Set((message.tasks ?? []).map((task) => task.id))];
  if (message.type !== "TASKS_REORDERED" || ids.length === 0) return payloads;

  const fallback = JSON.stringify({
    type: "PROJECT_UPDATED",
    projectId: message.projectId,
  });
  for (const userId of new Set(userIds)) {
    const scope = (await loadTaskScopes(userId, [workspaceId])).get(
      workspaceId,
    );
    if (!scope) continue;
    const visible = await db
      .select({ id: taskTable.id })
      .from(taskTable)
      .where(and(inArray(taskTable.id, ids), taskVisibleCondition(scope)));
    if (visible.length < ids.length) payloads.set(userId, fallback);
  }
  return payloads;
}
