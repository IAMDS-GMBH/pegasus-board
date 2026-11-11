// Named permission bundles the web app gates UI on. The API evaluates them all
// in one request (GET /workspace/{id}/capabilities) with the same rules it
// enforces, so custom workspace roles behave the same in the UI and the API.
export const workspaceCapabilities = {
  manageProjects: { project: ["create", "update", "delete"] },
  createProjects: { project: ["create"] },
  updateProjects: { project: ["update"] },
  shareProjects: { project: ["share"] },
  deleteProjects: { project: ["delete"] },
  updateTasks: { task: ["update"] },
  createTasks: { task: ["create"] },
  deleteTasks: { task: ["delete"] },
  assignTasks: { task: ["assign"] },
  // Pegasus fork (PEGA-142): lead actions the Hub grants separately. For
  // members it does not govern they keep Kaneo's rules: moving and labelling
  // cards need what the routes check, export and statistics only reading.
  moveTasks: { task: ["update"] },
  labelTasks: { label: ["update"] },
  exportTasks: { task: ["read"] },
  viewReports: { project: ["read"] },
  // Pegasus fork (PEGA-143): giving back one's own card. The route also
  // requires the caller to be the assignee; the capability only says whether
  // the right is there.
  returnTasks: { task: ["update"] },
  createLabels: { label: ["create"] },
  updateLabels: { label: ["update"] },
  deleteLabels: { label: ["delete"] },
  manageWorkspace: { workspace: ["update", "manage_settings"] },
  manageSettings: { workspace: ["manage_settings"] },
  deleteWorkspace: { workspace: ["delete"] },
  inviteUsers: { invitation: ["create"] },
  manageTeam: { member: ["update", "delete"] },
  updateMembers: { member: ["update"] },
  removeMembers: { member: ["delete"] },
} as const satisfies Record<string, Record<string, readonly string[]>>;

export type WorkspaceCapability = keyof typeof workspaceCapabilities;

export const WORKSPACE_CAPABILITY_NAMES = Object.keys(
  workspaceCapabilities,
) as WorkspaceCapability[];
