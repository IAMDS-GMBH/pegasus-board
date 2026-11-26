import { and, eq, inArray } from "drizzle-orm";
import type { Context, Next } from "hono";
import { assertColumnsUnlocked } from "../../column-lock/assert-columns-unlocked";
import {
  columnChange,
  type TouchedColumn,
} from "../../column-lock/column-change";
import db from "../../database";
import { projectTable, taskTable } from "../../database/schema";
import { assertProjectAccess } from "../../project-access/assert-project-access";
import { assertColumnsVisible } from "../../task-scope/assert-columns-visible";
import { readJsonBody } from "../../utils/read-json-body";
import { resolveDestinationStatus } from "./move-task";

// Pegasus fork (PEGA-170): members may not move cards into or out of a locked
// column (Eingang, Pegasus-Pool). Each middleware runs after the route's
// permission check and only works out which columns the request touches;
// assertColumnsUnlocked decides. Body fields are read raw: invalid input
// touches nothing here and fails in the validator.
//
// The Nachtrag (26.11.2026) adds restricted columns: members who do not see
// them may not put a card into one either. That is checked first, so the lock
// message never names a column the caller may not see.

async function assertColumnsUsable(
  c: Context,
  touched: readonly TouchedColumn[],
): Promise<void> {
  await assertColumnsVisible(c, touched);
  await assertColumnsUnlocked(c, touched);
}

type TaskRow = { id: string; projectId: string; status: string };

async function loadTasks(ids: readonly string[]): Promise<TaskRow[]> {
  if (ids.length === 0) return [];
  return db
    .select({
      id: taskTable.id,
      projectId: taskTable.projectId,
      status: taskTable.status,
    })
    .from(taskTable)
    .where(inArray(taskTable.id, [...ids]));
}

const stringsOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

/** `PUT /task/status/{id}` and the full update `PUT /task/{id}`. */
export async function requireTaskColumnUnlocked(c: Context, next: Next) {
  const { status } = await readJsonBody(c);
  const [task] = await loadTasks([c.req.param("id") ?? ""]);
  if (task) {
    await assertColumnsUsable(
      c,
      columnChange(task.projectId, task.status, status),
    );
  }
  return next();
}

/** `POST /task/reorder`: reordering within a column stays allowed. */
export async function requireReorderColumnsUnlocked(c: Context, next: Next) {
  const { tasks } = await readJsonBody(c);
  const moves = Array.isArray(tasks)
    ? (tasks as Array<{ id?: unknown; status?: unknown }>).filter(
        (task) =>
          typeof task?.id === "string" && typeof task.status === "string",
      )
    : [];
  const current = await loadTasks(moves.map((task) => task.id as string));
  await assertColumnsUsable(
    c,
    current.flatMap((row) =>
      columnChange(
        row.projectId,
        row.status,
        moves.find((task) => task.id === row.id)?.status,
      ),
    ),
  );
  return next();
}

/** `PATCH /task/bulk` with `updateStatus`. */
export async function requireBulkColumnsUnlocked(c: Context, next: Next) {
  const { operation, taskIds, value } = await readJsonBody(c);
  if (operation === "updateStatus") {
    const current = await loadTasks(stringsOf(taskIds));
    await assertColumnsUsable(
      c,
      current.flatMap((row) => columnChange(row.projectId, row.status, value)),
    );
  }
  return next();
}

// The destination as the controller would resolve it, or null where the
// controller rejects the move anyway (another workspace, no access, unknown
// status), so the lock never names a column the caller may not see.
async function moveDestination(
  c: Context,
  task: TaskRow,
  destinationProjectId: string,
  destinationStatus: unknown,
): Promise<string | null> {
  const [project] = await db
    .select({ id: projectTable.id })
    .from(projectTable)
    .where(
      and(
        eq(projectTable.id, destinationProjectId),
        eq(projectTable.workspaceId, (c.get("workspaceId") as string) ?? ""),
      ),
    )
    .limit(1);
  if (!project) return null;
  try {
    await assertProjectAccess(
      (c.get("userId") as string) ?? "",
      destinationProjectId,
    );
    const column = await resolveDestinationStatus(
      destinationProjectId,
      task.status,
      typeof destinationStatus === "string" ? destinationStatus : undefined,
    );
    return column.slug;
  } catch {
    return null;
  }
}

/** `PUT /task/move/{id}`: leaves the source column, enters the destination's. */
export async function requireMoveColumnsUnlocked(c: Context, next: Next) {
  const { destinationProjectId, destinationStatus } = await readJsonBody(c);
  const [task] = await loadTasks([c.req.param("id") ?? ""]);
  if (task && typeof destinationProjectId === "string") {
    const destination = await moveDestination(
      c,
      task,
      destinationProjectId,
      destinationStatus,
    );
    await assertColumnsUsable(c, [
      ...columnChange(task.projectId, null, task.status),
      ...columnChange(destinationProjectId, null, destination),
    ]);
  }
  return next();
}

/** `POST /task/{projectId}` and `POST /task/import/{projectId}`. */
export async function requireCreateColumnsUnlocked(c: Context, next: Next) {
  const projectId = c.req.param("projectId") ?? "";
  const body = await readJsonBody(c);
  const statuses = Array.isArray(body.tasks)
    ? (body.tasks as Array<{ status?: unknown }>).map((task) => task?.status)
    : [body.status ?? "to-do"];
  await assertColumnsUsable(
    c,
    statuses.flatMap((status) => columnChange(projectId, null, status)),
  );
  return next();
}

/** `POST /task/duplicate/{id}`: the copy lands in the original's column. */
export async function requireDuplicateColumnUnlocked(c: Context, next: Next) {
  const [task] = await loadTasks([c.req.param("id") ?? ""]);
  if (task) {
    await assertColumnsUsable(
      c,
      columnChange(task.projectId, null, task.status),
    );
  }
  return next();
}
