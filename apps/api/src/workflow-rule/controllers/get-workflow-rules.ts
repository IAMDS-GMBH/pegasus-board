import { and, eq, sql } from "drizzle-orm";
import db from "../../database";
import { columnTable, workflowRuleTable } from "../../database/schema";
import type { TaskScope } from "../../task-scope/task-scope";

async function getWorkflowRules(
  projectId: string,
  // Pegasus fork (PEGA-170): rules into restricted columns stay hidden.
  scope: TaskScope | null = null,
) {
  const rules = await db
    .select({
      id: workflowRuleTable.id,
      projectId: workflowRuleTable.projectId,
      integrationType: workflowRuleTable.integrationType,
      eventType: workflowRuleTable.eventType,
      columnId: workflowRuleTable.columnId,
      columnName: columnTable.name,
      columnSlug: columnTable.slug,
      createdAt: workflowRuleTable.createdAt,
      updatedAt: workflowRuleTable.updatedAt,
    })
    .from(workflowRuleTable)
    .leftJoin(columnTable, eq(workflowRuleTable.columnId, columnTable.id))
    .where(
      and(
        eq(workflowRuleTable.projectId, projectId),
        scope?.hidesRestrictedColumns
          ? sql`${columnTable.isRestricted} is not true`
          : undefined,
      ),
    );

  return rules;
}

export default getWorkflowRules;
