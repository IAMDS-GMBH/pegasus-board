// Pegasus fork (PEGA-6, PEGA-141, PEGA-142, PEGA-170): what a restricted
// member may see in one workspace. A task is visible when all hold: it is
// assigned to `userId` (only if `assignedOnly`), its unit (`pegasus_task_unit`)
// is in `unitIds` (only if not `null`; an empty list admits nothing), and its
// column is not restricted (only if `hidesRestrictedColumns`; such members do
// not see restricted columns either). `null` for the whole scope stands for
// unrestricted.
export type TaskScope = {
  userId: string;
  assignedOnly: boolean;
  unitIds: readonly string[] | null;
  hidesRestrictedColumns: boolean;
};

// Scopes by workspace id, holding only the workspaces where the user is
// restricted. Used by reads that span workspaces and by notifications.
export type TaskScopes = ReadonlyMap<string, TaskScope>;

export type HubMode = "all" | "units" | "assigned";

export type HubScope = { mode: HubMode; unitIds: readonly string[] };
