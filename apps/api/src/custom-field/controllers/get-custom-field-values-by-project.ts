import { and, eq } from "drizzle-orm";
import db from "../../database";
import {
  customFieldDefinitionTable,
  customFieldValueTable,
  taskTable,
} from "../../database/schema";
import type { TaskScope } from "../../task-scope/task-scope";
import { taskVisibleCondition } from "../../task-scope/task-visible-condition";

// Pegasus fork: `scope` applies the task row filter (assigned-only, Hub
// scope) so the board chip never leaks values of hidden tasks.
async function getCustomFieldValuesByProject(
  projectId: string,
  scope: TaskScope | null = null,
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
      fieldShowOnCard: customFieldDefinitionTable.showOnCard,
    })
    .from(customFieldValueTable)
    .innerJoin(taskTable, eq(customFieldValueTable.taskId, taskTable.id))
    .innerJoin(
      customFieldDefinitionTable,
      eq(customFieldValueTable.fieldId, customFieldDefinitionTable.id),
    )
    .where(
      and(eq(taskTable.projectId, projectId), taskVisibleCondition(scope)),
    );
}

export default getCustomFieldValuesByProject;
