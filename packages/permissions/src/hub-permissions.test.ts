import { describe, expect, it } from "vite-plus/test";
import { workspaceCapabilities } from "./capabilities";
import { capabilityHubPermission, HUB_PERMISSIONS } from "./hub-permissions";

// Pegasus fork (PEGA-142): which Hub right decides a capability for members
// the Hub governs.
describe("capabilityHubPermission", () => {
  it("maps the lead capabilities to the Hub's rights", () => {
    expect(capabilityHubPermission).toEqual({
      createTasks: "LEAD_CREATE",
      updateTasks: "LEAD_EDIT",
      labelTasks: "LEAD_EDIT",
      moveTasks: "LEAD_MOVE_STAGE",
      assignTasks: "LEAD_ASSIGN_PROCESSOR",
      deleteTasks: "LEAD_DELETE",
      exportTasks: "LEAD_EXPORT",
      viewReports: "REPORTING_VIEW",
    });
  });

  it("only names capabilities and rights that exist", () => {
    for (const [capability, right] of Object.entries(capabilityHubPermission)) {
      expect(Object.keys(workspaceCapabilities)).toContain(capability);
      expect(HUB_PERMISSIONS).toContain(right);
    }
  });
});
