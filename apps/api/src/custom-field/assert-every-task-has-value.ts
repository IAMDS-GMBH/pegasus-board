import { and, eq, notExists, sql } from "drizzle-orm";
import type db from "../database";
import { customFieldValueTable, taskTable } from "../database/schema";
import { fieldError } from "./field-error";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Pegasus fork (PEGA-123): a required field without a default can't fill
// tasks that have no value, so it is only allowed while there are none. A new
// field (no `fieldId` yet) has no values, so any task in the project counts.
export async function assertEveryTaskHasValue(
  tx: Transaction,
  { projectId, fieldId }: { projectId: string; fieldId?: string },
) {
  const hasValue = fieldId
    ? tx
        .select({ one: sql`1` })
        .from(customFieldValueTable)
        .where(
          and(
            eq(customFieldValueTable.taskId, taskTable.id),
            eq(customFieldValueTable.fieldId, fieldId),
            sql`btrim(coalesce(${customFieldValueTable.value}, '')) not in ('', '[]')`,
          ),
        )
    : undefined;

  const [taskWithoutValue] = await tx
    .select({ id: taskTable.id })
    .from(taskTable)
    .where(
      and(
        eq(taskTable.projectId, projectId),
        hasValue ? notExists(hasValue) : undefined,
      ),
    )
    .limit(1);

  if (taskWithoutValue) {
    fieldError(
      "CUSTOM_FIELD_REQUIRED_MISSING_VALUES",
      "A required field without a default needs a value on every task. Set a default or fill the tasks first.",
    );
  }
}
