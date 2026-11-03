import type { HubScope, TaskScope } from "./task-scope";

// Both restrictions narrow what a member sees; when a role carries both, a
// task is visible if either admits it. A hub-scoped member the Hub did not
// send (`hub: null`) sees nothing through that restriction.
export function composeTaskScope(input: {
  userId: string;
  assignedOnly: boolean;
  hubScoped: boolean;
  hub: HubScope | null;
}): TaskScope | null {
  const hub = input.hubScoped ? input.hub : null;
  if (!input.assignedOnly && !input.hubScoped) return null;
  if (hub?.mode === "all") return null;

  return {
    userId: input.userId,
    assigned: input.assignedOnly || hub?.mode === "assigned",
    unitIds: hub?.mode === "units" ? hub.unitIds : [],
  };
}
