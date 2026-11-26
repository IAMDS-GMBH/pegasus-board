import { and, eq, inArray } from "drizzle-orm";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { TouchedColumn } from "../column-lock/column-change";
import db from "../database";
import { columnTable } from "../database/schema";
import { resolveTaskScope } from "./resolve-task-scope";

/**
 * Pegasus fork (PEGA-170): a member who does not see restricted columns may
 * not put a card into one. Answers like an unknown status, so the column
 * stays invisible. Cards in a restricted column are already hidden from such
 * members (404), so only destinations are checked.
 */
export async function assertColumnsVisible(
  c: Context,
  touched: readonly TouchedColumn[],
): Promise<void> {
  const targets = touched.filter((t) => t.into);
  if (targets.length === 0) return;
  if (!(await resolveTaskScope(c))?.hidesRestrictedColumns) return;

  const restricted = await db
    .select({ projectId: columnTable.projectId, slug: columnTable.slug })
    .from(columnTable)
    .where(
      and(
        eq(columnTable.isRestricted, true),
        inArray(columnTable.projectId, [
          ...new Set(targets.map((t) => t.projectId)),
        ]),
        inArray(columnTable.slug, [...new Set(targets.map((t) => t.slug))]),
      ),
    );
  const hit = targets.find((t) =>
    restricted.some(
      (column) => column.projectId === t.projectId && column.slug === t.slug,
    ),
  );
  if (hit) {
    throw new HTTPException(400, { message: `Invalid status "${hit.slug}"` });
  }
}
