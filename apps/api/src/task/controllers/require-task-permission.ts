import { eq, inArray } from "drizzle-orm";
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireEntitlement } from "../../billing/require-entitlement-middleware";
import db from "../../database";
import { taskTable } from "../../database/schema";
import {
  requireHubPermission,
  requireLeadPermission,
} from "../../utils/require-hub-permission";

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

// Route middleware runs before the validators, so c.req.valid() is unavailable.
async function readJsonBody(c: Context): Promise<Record<string, unknown>> {
  const raw = (await c.req.json().catch(() => ({}))) as unknown;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {};
  }
  return raw as Record<string, unknown>;
}

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

export async function requireTaskAssigneePermission(c: Context, next: Next) {
  const id = c.req.param("id");
  const { userId } = await readJsonBody(c);
  const nextAssignee = typeof userId === "string" ? userId : null;

  const [existingTask] = await db
    .select({ userId: taskTable.userId })
    .from(taskTable)
    .where(eq(taskTable.id, id ?? ""))
    .limit(1);

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
  const id = c.req.param("id");
  const { status } = await readJsonBody(c);

  const [existingTask] = await db
    .select({ status: taskTable.status })
    .from(taskTable)
    .where(eq(taskTable.id, id ?? ""))
    .limit(1);

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
// LEAD_MOVE_STAGE, reordering within its column LEAD_EDIT.
export async function requireReorderPermission(c: Context, next: Next) {
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
