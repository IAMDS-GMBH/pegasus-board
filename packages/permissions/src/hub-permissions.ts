import type { WorkspaceCapability } from "./capabilities.js";

// Pegasus fork (PEGA-142): the rights the Pegasus Hub computes per user and
// pushes with the visibility (`PUT /pegasus-visibility/workspace/{id}/users`).
// Keys are the Hub's, unchanged. The board stores unknown keys too; these are
// the ones it knows. Only some guard a board action today; the others
// (archive, reassign, return, BSI handover, mails, admin) wait for their
// process stories.
export const HUB_PERMISSIONS = [
  "LEAD_READ",
  "LEAD_EDIT",
  "LEAD_MOVE_STAGE",
  "LEAD_CREATE",
  "LEAD_ASSIGN_PROCESSOR",
  "LEAD_REASSIGN_UNIT",
  "LEAD_RETURN_OR_REPORT",
  "LEAD_ARCHIVE",
  "LEAD_DELETE",
  "LEAD_EXPORT",
  "LEAD_HANDOVER_BSI",
  "COMM_SEND",
  "COMM_SEND_ON_BEHALF",
  "REPORTING_VIEW",
  "ADMIN_USERS",
  "ADMIN_ROLES_AND_GRANTS",
  "ADMIN_HIERARCHY",
  "ADMIN_CAMPAIGNS",
  "ADMIN_SYSTEM_SETTINGS",
] as const;

export type HubPermission = (typeof HUB_PERMISSIONS)[number];

// The right that decides a capability for members the Hub governs, in place
// of the capability's Kaneo permissions (`GET /workspace/{id}/capabilities`).
export const capabilityHubPermission = {
  createTasks: "LEAD_CREATE",
  updateTasks: "LEAD_EDIT",
  labelTasks: "LEAD_EDIT",
  moveTasks: "LEAD_MOVE_STAGE",
  assignTasks: "LEAD_ASSIGN_PROCESSOR",
  deleteTasks: "LEAD_DELETE",
  exportTasks: "LEAD_EXPORT",
  viewReports: "REPORTING_VIEW",
} as const satisfies Partial<Record<WorkspaceCapability, HubPermission>>;
