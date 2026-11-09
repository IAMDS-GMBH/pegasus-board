import type { HubPermission } from "@kaneo/permissions";
import type { Context, Next } from "hono";
import { ApiError } from "../errors/api-error";
import { resolveMemberAccess } from "../task-scope/resolve-task-scope";
import { readJsonBody } from "./read-json-body";
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

type HubKeys = HubPermission | readonly HubPermission[];

const asList = (keys: HubKeys): readonly HubPermission[] =>
  typeof keys === "string" ? [keys] : keys;

/** False only when a governed member lacks any of `keys`. */
export async function hubAllows(c: Context, keys: HubKeys) {
  const { permissions } = await resolveMemberAccess(c);
  return !permissions || asList(keys).every((key) => permissions.has(key));
}

/** Throws 403 `MISSING_PERMISSION` when a governed member lacks any of `keys`. */
export async function requireHubPermission(c: Context, keys: HubKeys) {
  const { permissions } = await resolveMemberAccess(c);
  if (!permissions) return;
  const missing = asList(keys).filter((key) => !permissions.has(key));
  if (missing.length > 0) {
    throw new ApiError(403, {
      message: "Insufficient permissions",
      code: "MISSING_PERMISSION",
      missingPermissions: missing,
    });
  }
}

/**
 * Middleware for a lead action: the Hub rights `hub` for governed members,
 * otherwise the Kaneo permissions `kaneo` (none when `null`).
 */
export function requireLeadPermission(
  kaneo: PermissionMap | null,
  hub: HubKeys,
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

/**
 * Middleware adding the Hub right `hub` for governed members when the raw
 * request body asks for what it guards, e.g. an assignee on a new lead.
 * Kaneo permissions are left to the route's other middleware.
 */
export function requireHubPermissionWhen(
  applies: (body: Record<string, unknown>) => boolean,
  hub: HubKeys,
) {
  return async (c: Context, next: Next) => {
    if (
      (await resolveMemberAccess(c)).permissions &&
      applies(await readJsonBody(c))
    ) {
      await requireHubPermission(c, hub);
    }
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
