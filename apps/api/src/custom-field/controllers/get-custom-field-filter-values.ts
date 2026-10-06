import { and, eq, inArray, isNotNull, ne } from "drizzle-orm";
import db from "../../database";
import {
  customFieldDefinitionTable,
  customFieldValueTable,
  taskTable,
} from "../../database/schema";

// Pegasus fork: `restrictToUserId` applies the assigned-only row filter.
// Definitions stay visible (project schema, not task data); only the
// distinct values are limited to the caller's own tasks.
export default async function getCustomFieldFilterValues(
  projectId: string,
  restrictToUserId: string | null = null,
) {
  const fields = await db
    .select()
    .from(customFieldDefinitionTable)
    .where(eq(customFieldDefinitionTable.projectId, projectId));

  if (fields.length === 0) {
    return [];
  }
  const rows = await db
    .selectDistinct({
      fieldId: customFieldValueTable.fieldId,
      value: customFieldValueTable.value,
    })
    .from(customFieldValueTable)
    .innerJoin(taskTable, eq(customFieldValueTable.taskId, taskTable.id))
    .where(
      and(
        inArray(
          customFieldValueTable.fieldId,
          fields.map((field) => field.id),
        ),
        isNotNull(customFieldValueTable.value),
        ne(customFieldValueTable.value, ""),
        restrictToUserId ? eq(taskTable.userId, restrictToUserId) : undefined,
      ),
    );
  const valuesByField = new Map<string, string[]>();
  for (const row of rows) {
    const bucket = valuesByField.get(row.fieldId) ?? [];
    bucket.push(row.value as string);
    valuesByField.set(row.fieldId, bucket);
  }
  return fields.map((field) => ({
    fieldId: field.id,
    fieldName: field.name,
    fieldType: field.type,
    values: valuesByField.get(field.id) ?? [],
  }));
}
