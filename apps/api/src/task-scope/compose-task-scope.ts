import type { HubScope, TaskScope } from "./task-scope";

// In a workspace the Hub manages, its scope applies to every governed member
// and the board's "assigned only" narrows it further; a member the Hub did
// not send (`hub: null`) sees nothing. Elsewhere only "assigned only" applies.
export function composeTaskScope(input: {
  userId: string;
  assignedOnly: boolean;
  managed: boolean;
  hub: HubScope | null;
}): TaskScope | null {
  const { userId, managed, hub } = input;
  const assignedOnly =
    input.assignedOnly || (managed && hub?.mode === "assigned");
  const unitIds = !managed
    ? null
    : !hub
      ? []
      : hub.mode === "units"
        ? hub.unitIds
        : null;

  if (!assignedOnly && unitIds === null) return null;
  return { userId, assignedOnly, unitIds };
}
