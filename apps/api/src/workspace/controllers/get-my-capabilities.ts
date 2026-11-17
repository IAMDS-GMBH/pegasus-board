import {
  capabilityHubPermission,
  hubUngovernedCapabilities,
  WORKSPACE_CAPABILITY_NAMES,
  type WorkspaceCapability,
  workspaceCapabilities,
} from "@kaneo/permissions";
import type { PermissionMap } from "../../utils/role-permissions";

// Pegasus fork (PEGA-142): for a member the Hub governs, its rights decide the
// lead capabilities instead of the Kaneo role; an API key still narrows them.
type HubRights = {
  permissions: ReadonlySet<string>;
  keyAllows: (permissions: PermissionMap) => boolean;
};

const ungovernedOnly: ReadonlySet<WorkspaceCapability> = new Set(
  hubUngovernedCapabilities,
);

function getMyCapabilities(
  allows: (permissions: PermissionMap) => boolean,
  hub: HubRights | null = null,
): Record<WorkspaceCapability, boolean> {
  const result = {} as Record<WorkspaceCapability, boolean>;
  for (const name of WORKSPACE_CAPABILITY_NAMES) {
    const permissions: PermissionMap = {};
    for (const [resource, actions] of Object.entries(
      workspaceCapabilities[name],
    )) {
      permissions[resource] = [...actions];
    }
    const hubRight =
      capabilityHubPermission[name as keyof typeof capabilityHubPermission];
    if (hub && ungovernedOnly.has(name)) {
      // PEGA-80: no governed member has these, whatever their role.
      result[name] = false;
      continue;
    }
    result[name] =
      hub && hubRight
        ? hub.keyAllows(permissions) && hub.permissions.has(hubRight)
        : allows(permissions);
  }
  return result;
}

export default getMyCapabilities;
