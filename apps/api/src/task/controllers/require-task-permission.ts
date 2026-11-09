import { eq, inArray } from "drizzle-orm";
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireEntitlement } from "../../billing/require-entitlement-middleware";
import db from "../../database";
import { taskTable } from "../../database/schema";
import { resolveMemberAccess } from "../../task-scope/resolve-task-scope";
import { readJsonBody } from "../../utils/read-json-body";
import {
  requireHubPermission,
  requireHubPermissionWhen,
  requireLeadPermission,
} from "../../utils/require-hub-permission";
import { requireWorkspacePermission } from "../../utils/require-workspace-permission";

type BulkTaskOperation =
  | "updateStatus"
  | "updatePriority"
  | "updateAssignee"
  | "delete"
  | "addLabel"
  | "removeLabel"
  | "updateDueDate";

const BULK_OPERATIONS: readonly BulkTaskOperation[] = [
  "updateStatus",
  "updatePriority",
  "updateAssignee",
  "delete",
  "addLabel",
  "removeLabel",
  "updateDueDate",
];

async function bulkOperation(c: Context): Promise<BulkTaskOperation> {
  const { operation } = await readJsonBody(c);
  if (
    typeof operation !== "string" ||
    !(BULK_OPERATIONS as readonly string[]).includes(operation)
  ) {
    throw new HTTPException(400, {
      message: `operation must be one of: ${BULK_OPERATIONS.join(", ")}`,
    });
  }
  return operation as BulkTaskOperation;
}

export async function requireBulkTaskPermission(c: Context, next: Next) {
  const operation = await bulkOperation(c);

  if (operation === "delete") {
    return requireLeadPermission({ task: ["delete"] }, "LEAD_DELETE")(c, next);
  }

  if (operation === "updateAssignee") {
    return requireLeadPermission({ task: ["assign"] }, "LEAD_ASSIGN_PROCESSOR")(
      c,
      next,
    );
  }

  if (operation === "addLabel" || operation === "removeLabel") {
    return requireLeadPermission({ label: ["update"] }, "LEAD_EDIT")(c, next);
  }

  if (operation === "updateStatus") {
    return requireLeadPermission({ task: ["update"] }, "LEAD_MOVE_STAGE")(
      c,
      next,
    );
  }

  return requireLeadPermission({ task: ["update"] }, "LEAD_EDIT")(c, next);
}

export async function requireBulkTaskEntitlement(c: Context, next: Next) {
  const operation = await bulkOperation(c);

  if (
    operation === "delete" ||
    operation === "addLabel" ||
    operation === "removeLabel"
  ) {
    return next();
  }

  return requireEntitlement(c, next);
}

const EXISTING_TASK_KEY = "existingTaskForPermission";
type ExistingTask = { status: string; userId: string | null } | null;

// The status and assignee checks of a full update share one lookup.
async function loadExistingTask(c: Context): Promise<ExistingTask> {
  const cached = c.get(EXISTING_TASK_KEY) as ExistingTask | undefined;
  if (cached !== undefined) return cached;
  const [row] = await db
    .select({ status: taskTable.status, userId: taskTable.userId })
    .from(taskTable)
    .where(eq(taskTable.id, c.req.param("id") ?? ""))
    .limit(1);
  const task = row ?? null;
  c.set(EXISTING_TASK_KEY, task);
  return task;
}

export async function requireTaskAssigneePermission(c: Context, next: Next) {
  const { userId } = await readJsonBody(c);
  const nextAssignee = typeof userId === "string" ? userId : null;
  const existingTask = await loadExistingTask(c);

  if (existingTask && existingTask.userId !== nextAssignee) {
    return requireLeadPermission({ task: ["assign"] }, "LEAD_ASSIGN_PROCESSOR")(
      c,
      next,
    );
  }

  return next();
}

// Pegasus fork (PEGA-142): a full update that changes the column is a stage
// move for governed members. Kaneo needs nothing beyond task:update for it.
export async function requireTaskStatusPermission(c: Context, next: Next) {
  if (!(await resolveMemberAccess(c)).permissions) return next();

  const { status } = await readJsonBody(c);
  const existingTask = await loadExistingTask(c);
  if (
    existingTask &&
    typeof status === "string" &&
    status !== existingTask.status
  ) {
    await requireHubPermission(c, "LEAD_MOVE_STAGE");
  }
  return next();
}

// Pegasus fork (PEGA-142): moving a card to another column needs
// LEAD_MOVE_STAGE, reordering within its column LEAD_EDIT. Kaneo needs
// task:update for both, so only governed members pay for the lookup.
export async function requireReorderPermission(c: Context, next: Next) {
  if (!(await resolveMemberAccess(c)).permissions) {
    return requireWorkspacePermission({ task: ["update"] })(c, next);
  }

  const { tasks } = await readJsonBody(c);
  const moves = Array.isArray(tasks)
    ? (tasks as Array<{ id?: unknown; status?: unknown }>).filter(
        (task) =>
          typeof task?.id === "string" && typeof task.status === "string",
      )
    : [];

  const current = moves.length
    ? await db
        .select({ id: taskTable.id, status: taskTable.status })
        .from(taskTable)
        .where(
          inArray(
            taskTable.id,
            moves.map((task) => task.id as string),
          ),
        )
    : [];
  const changesColumn = moves.some((task) =>
    current.some((row) => row.id === task.id && row.status !== task.status),
  );

  return requireLeadPermission(
    { task: ["update"] },
    changesColumn ? "LEAD_MOVE_STAGE" : "LEAD_EDIT",
  )(c, next);
}

const namesAssignee = (value: unknown) =>
  typeof value === "string" && value.trim() !== "";

// Pegasus fork (PEGA-142): a lead created with an assignee is an assignment,
// so governed members need LEAD_ASSIGN_PROCESSOR on top of LEAD_CREATE.
export const requireCreateAssigneePermission = requireHubPermissionWhen(
  (body) => namesAssignee(body.userId),
  "LEAD_ASSIGN_PROCESSOR",
);

export const requireImportAssigneePermission = requireHubPermissionWhen(
  (body) =>
    Array.isArray(body.tasks) &&
    body.tasks.some((task) => namesAssignee(task?.userId)),
  "LEAD_ASSIGN_PROCESSOR",
);
