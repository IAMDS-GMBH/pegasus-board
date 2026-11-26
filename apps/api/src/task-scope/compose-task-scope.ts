import type { HubScope, TaskScope } from "./task-scope";

// In a workspace the Hub manages, its scope applies to every governed member
// and the board's "assigned only" narrows it further; a member the Hub did
// not send (`hub: null`) sees nothing. Restricted columns (PEGA-170) stay
// hidden there unless the Hub granted LEAD_READ_INTAKE (`readsIntake`).
// Elsewhere only "assigned only" applies.
export function composeTaskScope(input: {
  userId: string;
  assignedOnly: boolean;
  managed: boolean;
  hub: HubScope | null;
  readsIntake: boolean;
}): TaskScope | null {
  const { userId, managed, hub } = input;
  const hidesRestrictedColumns = managed && !input.readsIntake;
  const assignedOnly =
    input.assignedOnly || (managed && hub?.mode === "assigned");
  const unitIds = !managed
    ? null
    : !hub
      ? []
      : hub.mode === "units"
        ? hub.unitIds
        : null;

  if (!assignedOnly && unitIds === null && !hidesRestrictedColumns) {
    return null;
  }
  return { userId, assignedOnly, unitIds, hidesRestrictedColumns };
}
