import { describe, expect, it } from "vite-plus/test";
import { workspaceCapabilities } from "./capabilities";
import {
  capabilityHubPermission,
  HUB_PERMISSIONS,
  hubUngovernedCapabilities,
} from "./hub-permissions";

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
      returnTasks: "LEAD_RETURN_OR_REPORT",
    });
  });

  it("only names capabilities and rights that exist", () => {
    for (const [capability, right] of Object.entries(capabilityHubPermission)) {
      expect(Object.keys(workspaceCapabilities)).toContain(capability);
      expect(HUB_PERMISSIONS).toContain(right);
    }
  });
});

// Pegasus fork (PEGA-80): capabilities the Hub withholds from every member it
// governs, whatever their Kaneo role.
describe("hubUngovernedCapabilities", () => {
  it("reserves managing integrations for members the Hub does not govern", () => {
    expect(hubUngovernedCapabilities).toEqual(["manageIntegrations"]);
  });

  it("names a capability that needs workspace:manage_settings", () => {
    expect(workspaceCapabilities.manageIntegrations).toEqual({
      workspace: ["manage_settings"],
    });
  });
});
