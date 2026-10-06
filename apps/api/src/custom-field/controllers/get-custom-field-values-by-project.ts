import { and, eq } from "drizzle-orm";
import db from "../../database";
import {
  customFieldDefinitionTable,
  customFieldValueTable,
  taskTable,
} from "../../database/schema";

// Pegasus fork: `restrictToUserId` applies the assigned-only row filter
// (task:view_assigned_only) so the board chip never leaks foreign task values.
async function getCustomFieldValuesByProject(
  projectId: string,
  restrictToUserId: string | null = null,
) {
  return db
    .select({
      id: customFieldValueTable.id,
      taskId: customFieldValueTable.taskId,
      fieldId: customFieldValueTable.fieldId,
      value: customFieldValueTable.value,
      fieldName: customFieldDefinitionTable.name,
      fieldPosition: customFieldDefinitionTable.position,
      fieldType: customFieldDefinitionTable.type,
      fieldOptions: customFieldDefinitionTable.options,
    })
    .from(customFieldValueTable)
    .innerJoin(taskTable, eq(customFieldValueTable.taskId, taskTable.id))
    .innerJoin(
      customFieldDefinitionTable,
      eq(customFieldValueTable.fieldId, customFieldDefinitionTable.id),
    )
    .where(
      and(
        eq(taskTable.projectId, projectId),
        restrictToUserId ? eq(taskTable.userId, restrictToUserId) : undefined,
      ),
    );
}

export default getCustomFieldValuesByProject;
