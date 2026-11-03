// Pegasus fork (PEGA-6, PEGA-141): what a restricted member may see in one
// workspace. A task is visible when it is assigned to `userId` (if `assigned`)
// or its unit (`pegasus_task_unit`) is in `unitIds`. `null` stands for
// unrestricted: instance admins, owners and roles without a restriction.
export type TaskScope = {
  userId: string;
  assigned: boolean;
  unitIds: readonly string[];
};

// Scopes by workspace id, holding only the workspaces where the user is
// restricted. Used by reads that span workspaces and by notifications.
export type TaskScopes = ReadonlyMap<string, TaskScope>;

export type HubMode = "all" | "units" | "assigned";

export type HubScope = { mode: HubMode; unitIds: readonly string[] };
