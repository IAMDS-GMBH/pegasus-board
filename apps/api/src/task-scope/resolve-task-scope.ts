import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { loadTaskScopes } from "./load-task-scopes";
import type { TaskScope } from "./task-scope";

const SCOPE_CONTEXT_KEY = "taskScope";

/**
 * The current user's scope in the request's workspace (set by
 * `workspaceAccess`), or `null` when unrestricted. Memoized on the context so
 * a middleware and a handler on the same request share one lookup.
 */
export async function resolveTaskScope(c: Context): Promise<TaskScope | null> {
  const cached = c.get(SCOPE_CONTEXT_KEY) as
    | { scope: TaskScope | null }
    | undefined;
  if (cached) return cached.scope;

  const workspaceId = c.get("workspaceId") as string | undefined;
  if (!workspaceId) {
    throw new HTTPException(500, {
      message: "workspaceId not set in context",
    });
  }

  const userId = c.get("userId") as string | undefined;
  // `loadTaskScopes` leaves instance admins unrestricted.
  const scope = userId
    ? ((await loadTaskScopes(userId, [workspaceId])).get(workspaceId) ?? null)
    : null;

  c.set(SCOPE_CONTEXT_KEY, { scope });
  return scope;
}
