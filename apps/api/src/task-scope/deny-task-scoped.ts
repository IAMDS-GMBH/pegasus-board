import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { resolveTaskScope } from "./resolve-task-scope";

/**
 * Middleware for workspace-wide task views that cannot be narrowed to the
 * user's scope, such as calendar feeds and integration sync. Runs after
 * `workspaceAccess`, which sets the workspace.
 */
export async function denyTaskScoped(c: Context, next: Next) {
  if (await resolveTaskScope(c)) {
    throw new HTTPException(403, {
      message: "Not available to roles with restricted task visibility",
    });
  }
  return next();
}
