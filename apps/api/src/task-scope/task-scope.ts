// Pegasus fork (PEGA-6, PEGA-141, PEGA-142): what a restricted member may see
// in one workspace. A task is visible when both hold: it is assigned to
// `userId` (only if `assignedOnly`), and its unit (`pegasus_task_unit`) is in
// `unitIds` (only if not `null`; an empty list admits nothing). `null` for the
// whole scope stands for unrestricted.
export type TaskScope = {
  userId: string;
  assignedOnly: boolean;
  unitIds: readonly string[] | null;
};

// Scopes by workspace id, holding only the workspaces where the user is
// restricted. Used by reads that span workspaces and by notifications.
export type TaskScopes = ReadonlyMap<string, TaskScope>;

export type HubMode = "all" | "units" | "assigned";

export type HubScope = { mode: HubMode; unitIds: readonly string[] };
