import { notInArray, or, type SQL, type SQLWrapper, sql } from "drizzle-orm";
import { columnTable } from "../database/schema";
import type { TaskScope, TaskScopes } from "./task-scope";

// Pegasus fork (PEGA-170): history entries (activities, notifications) that
// name a restricted column as old or new status stay hidden from members who
// do not see restricted columns, so a released card's history does not reveal
// the technical stages. Only builds SQL, like task-visible-condition.ts.

type StatusEntry = {
  /** jsonb with `oldStatus` / `newStatus` slugs; entries without them pass. */
  eventData: SQLWrapper;
  /** Projects the slugs may belong to (the task's, the one it moved from). */
  projectIds: readonly SQLWrapper[];
};

function namesNoRestrictedColumn({ eventData, projectIds }: StatusEntry): SQL {
  return sql`not exists (select 1 from ${columnTable} as restricted_status_column where restricted_status_column.is_restricted and restricted_status_column.project_id in (${sql.join([...projectIds], sql`, `)}) and restricted_status_column.slug in (${eventData}->>'oldStatus', ${eventData}->>'newStatus'))`;
}

/** `undefined` for a scope that shows restricted columns. */
export function statusChangeVisibleCondition(
  scope: TaskScope | null,
  entry: StatusEntry,
): SQL | undefined {
  return scope?.hidesRestrictedColumns
    ? namesNoRestrictedColumn(entry)
    : undefined;
}

/** The same for reads that span workspaces. */
export function statusChangesVisibleCondition(
  scopes: TaskScopes,
  entry: StatusEntry & { workspaceId: SQLWrapper },
): SQL | undefined {
  const hiding = [...scopes]
    .filter(([, scope]) => scope.hidesRestrictedColumns)
    .map(([workspaceId]) => workspaceId);
  if (hiding.length === 0) return undefined;
  return or(
    notInArray(sql`${entry.workspaceId}`, hiding),
    namesNoRestrictedColumn(entry),
  );
}
