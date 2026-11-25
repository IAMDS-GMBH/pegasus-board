import type { Context, Next } from "hono";
import { ApiError } from "../errors/api-error";
import { resolveMemberAccess } from "../task-scope/resolve-task-scope";

// Pegasus fork (PEGA-142, PEGA-80): once the Hub manages a workspace, a member
// it governs must not rewrite what the Hub owns there, whatever their Kaneo
// role: the snapshot that governs them (pegasus-visibility) and the project
// integrations, above all the Hub's own Generic Webhook. Owners, instance
// admins and the Hub's system account are never governed, so they keep these
// routes; before the first snapshot nobody is.

/** True for a member the Hub governs in the request's workspace. */
export async function isHubGoverned(c: Context) {
  return (await resolveMemberAccess(c)).permissions !== null;
}

/** Throws 403 `HUB_GOVERNED` for a member the Hub governs. */
export async function denyHubGoverned(c: Context, next: Next) {
  if (await isHubGoverned(c)) {
    throw new ApiError(403, {
      message:
        "Only the Pegasus Hub's system account, owners and instance admins can do this in a workspace the Hub manages",
      code: "HUB_GOVERNED",
    });
  }
  return next();
}
