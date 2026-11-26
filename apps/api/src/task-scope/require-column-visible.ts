import { and, eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { columnTable } from "../database/schema";
import { columnVisibleCondition } from "./column-visible-condition";
import { resolveTaskScope } from "./resolve-task-scope";

/**
 * Pegasus fork (PEGA-170): middleware for routes on one column (`:id`). A
 * restricted column answers 404 to members who may not see it, as if it did
 * not exist. Runs after `workspaceAccess.fromColumn`.
 */
export async function requireColumnVisible(c: Context, next: Next) {
  const scope = await resolveTaskScope(c);
  if (scope?.hidesRestrictedColumns) {
    const [column] = await db
      .select({ id: columnTable.id })
      .from(columnTable)
      .where(
        and(
          eq(columnTable.id, c.req.param("id") ?? ""),
          columnVisibleCondition(scope),
        ),
      )
      .limit(1);
    if (!column) throw new HTTPException(404, { message: "Column not found" });
  }
  return next();
}
