import { and, eq, inArray } from "drizzle-orm";
import type { Context } from "hono";
import db from "../database";
import { columnTable } from "../database/schema";
import { ApiError } from "../errors/api-error";
import type { TouchedColumn } from "./column-change";
import { isColumnLockExempt } from "./is-column-lock-exempt";

// Pegasus fork (PEGA-170): rejects a request that moves a card into or out of
// a locked column. Only requests that touch a locked column pay for the
// exemption lookup.
export async function assertColumnsUnlocked(
  c: Context,
  touched: readonly TouchedColumn[],
): Promise<void> {
  if (touched.length === 0) return;

  const projectIds = [...new Set(touched.map((t) => t.projectId))];
  const slugs = [...new Set(touched.map((t) => t.slug))];
  const locked = await db
    .select({
      projectId: columnTable.projectId,
      slug: columnTable.slug,
      name: columnTable.name,
    })
    .from(columnTable)
    .where(
      and(
        eq(columnTable.isLocked, true),
        inArray(columnTable.projectId, projectIds),
        inArray(columnTable.slug, slugs),
      ),
    );
  const hit = locked.find((column) =>
    touched.some(
      (t) => t.projectId === column.projectId && t.slug === column.slug,
    ),
  );
  if (!hit) return;

  if (
    await isColumnLockExempt(
      c.get("userId") as string | undefined,
      c.get("workspaceId") as string | undefined,
    )
  ) {
    return;
  }

  throw new ApiError(403, {
    message: `Column „${hit.name}“ is locked: only the Hub moves cards into or out of it.`,
    code: "COLUMN_LOCKED",
  });
}
