import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { loadMemberAccess, type MemberAccess } from "./load-task-scopes";
import type { TaskScope } from "./task-scope";

const ACCESS_CONTEXT_KEY = "memberAccess";
const UNRESTRICTED: MemberAccess = { scope: null, permissions: null };

/**
 * The current user's scope and Hub rights in the request's workspace (set by
 * `workspaceAccess`). Memoized on the context so middlewares and the handler
 * on the same request share one lookup.
 */
export async function resolveMemberAccess(c: Context): Promise<MemberAccess> {
  const cached = c.get(ACCESS_CONTEXT_KEY) as MemberAccess | undefined;
  if (cached) return cached;

  const workspaceId = c.get("workspaceId") as string | undefined;
  if (!workspaceId) {
    throw new HTTPException(500, {
      message: "workspaceId not set in context",
    });
  }

  const userId = c.get("userId") as string | undefined;
  const access = userId
    ? ((await loadMemberAccess(userId, [workspaceId])).get(workspaceId) ??
      UNRESTRICTED)
    : UNRESTRICTED;

  c.set(ACCESS_CONTEXT_KEY, access);
  return access;
}

/** The current user's scope, or `null` when they see every task. */
export async function resolveTaskScope(c: Context): Promise<TaskScope | null> {
  return (await resolveMemberAccess(c)).scope;
}
