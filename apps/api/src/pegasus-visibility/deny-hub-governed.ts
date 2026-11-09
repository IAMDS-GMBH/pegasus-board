import type { Context, Next } from "hono";
import { ApiError } from "../errors/api-error";
import { resolveMemberAccess } from "../task-scope/resolve-task-scope";

// Pegasus fork (PEGA-142): once the Hub manages a workspace, a member it
// governs must not rewrite the snapshot that governs them, whatever their
// Kaneo role. Owners, instance admins and the Hub's system account are never
// governed, so they keep these routes; before the first snapshot nobody is.
export async function denyHubGoverned(c: Context, next: Next) {
  if ((await resolveMemberAccess(c)).permissions) {
    throw new ApiError(403, {
      message:
        "Only the Pegasus Hub's system account, owners and instance admins can manage the visibility of a workspace the Hub manages",
      code: "HUB_GOVERNED",
    });
  }
  return next();
}
