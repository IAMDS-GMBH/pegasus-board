import type { HubPermission } from "@kaneo/permissions";
import type { Context, Next } from "hono";
import { ApiError } from "../errors/api-error";
import { resolveMemberAccess } from "../task-scope/resolve-task-scope";
import {
  apiKeyAllows,
  assertApiKeyScope,
  hasWorkspacePermission,
  requireWorkspacePermission,
} from "./require-workspace-permission";
import type { PermissionMap } from "./role-permissions";

// Pegasus fork (PEGA-142): in a workspace the Hub manages, the rights it
// pushed replace the Kaneo role check on lead (task) actions for every
// governed member. Kaneo roles keep deciding board-own things (labels,
// columns, settings) and everything for owners, instance admins and the Hub's
// system account. An API key still narrows a governed member by its scope.

/** False only when a governed member lacks `key`. */
export async function hubAllows(c: Context, key: HubPermission) {
  const { permissions } = await resolveMemberAccess(c);
  return !permissions || permissions.has(key);
}

/** Throws 403 `MISSING_PERMISSION` when a governed member lacks `key`. */
export async function requireHubPermission(c: Context, key: HubPermission) {
  if (!(await hubAllows(c, key))) {
    throw new ApiError(403, {
      message: "Insufficient permissions",
      code: "MISSING_PERMISSION",
      missingPermissions: [key],
    });
  }
}

/**
 * Middleware for a lead action: the Hub right `hub` for governed members,
 * otherwise the Kaneo permissions `kaneo` (none when `null`).
 */
export function requireLeadPermission(
  kaneo: PermissionMap | null,
  hub: HubPermission,
) {
  return async (c: Context, next: Next) => {
    if (!(await resolveMemberAccess(c)).permissions) {
      return kaneo ? requireWorkspacePermission(kaneo)(c, next) : next();
    }
    if (kaneo) assertApiKeyScope(c, kaneo);
    await requireHubPermission(c, hub);
    return next();
  };
}

/** The boolean form of `requireLeadPermission`, for checks inside a handler. */
export async function hasLeadPermission(
  c: Context,
  kaneo: PermissionMap,
  hub: HubPermission,
) {
  if (!(await resolveMemberAccess(c)).permissions) {
    return hasWorkspacePermission(c, kaneo);
  }
  return apiKeyAllows(c, kaneo) && (await hubAllows(c, hub));
}
