import { Bell } from "lucide-react";
import { describe, expect, it } from "vite-plus/test";
import { buildSettingsNav } from "@/components/settings/nav/build-settings-nav";

const t = (key: string) => key;

function build(
  overrides: Partial<Parameters<typeof buildSettingsNav>[0]> = {},
) {
  return buildSettingsNav({
    t,
    workspaceName: "Acme",
    billingEnabled: false,
    canImport: false,
    hasAdminAccess: false,
    notificationSettingsUrl: null,
    canManageIntegrations: false,
    projects: [],
    ...overrides,
  });
}

describe("buildSettingsNav", () => {
  it("labels the workspace group with the workspace name", () => {
    expect(build().workspace.label).toBe("Acme");
    expect(build({ workspaceName: undefined }).workspace.label).toBe(
      "navigation:page.settingsWorkspaceTab",
    );
  });

  it("only offers billing when billing is enabled", () => {
    const linkIds = (nav: ReturnType<typeof build>) =>
      nav.workspace.links.map((link) => link.id);

    expect(linkIds(build())).not.toContain("workspace-billing");
    expect(linkIds(build({ billingEnabled: true }))).toContain(
      "workspace-billing",
    );
  });

  it("only offers import to people who can import", () => {
    const links = (nav: ReturnType<typeof build>) =>
      nav.workspace.links.map((link) => link.to);

    expect(links(build())).not.toContain(
      "/dashboard/settings/workspace/import",
    );
    expect(links(build({ canImport: true, billingEnabled: true }))).toEqual([
      "/dashboard/settings/workspace/general",
      "/dashboard/settings/workspace/roles",
      "/dashboard/settings/workspace/labels",
      "/dashboard/settings/workspace/import",
      "/dashboard/settings/workspace/billing",
    ]);
  });

  it("only shows administration to instance admins", () => {
    expect(build().admin).toBeNull();
    expect(
      build({ hasAdminAccess: true }).admin?.links.map((link) => link.to),
    ).toEqual([
      "/dashboard/settings/admin/users",
      "/dashboard/settings/admin/workspaces",
    ]);
  });

  it("gives every project its own settings pages", () => {
    const nav = build({
      canManageIntegrations: true,
      projects: [{ id: "p1", name: "Kaneo Web", icon: "Unknown" }],
    });

    expect(nav.projects).toHaveLength(1);
    expect(nav.projects[0]?.links.map((link) => link.to)).toEqual([
      "/dashboard/settings/projects/p1/general",
      "/dashboard/settings/projects/p1/workflow",
      "/dashboard/settings/projects/p1/custom-fields",
      "/dashboard/settings/projects/p1/visibility",
      "/dashboard/settings/projects/p1/integrations",
      "/dashboard/settings/projects/p1/calendar",
    ]);
    expect(nav.projects[0]?.links[2]?.label).toBe(
      "settings:projectCustomFields.title",
    );
    expect(nav.projects[0]?.icon).toBeDefined();
  });

  // Pegasus fork (PEGA-80): the Pegasus Hub owns notification settings and
  // only members it does not govern may manage integrations.
  describe("Pegasus Hub", () => {
    const accountLink = (nav: ReturnType<typeof build>, id: string) =>
      nav.account.links.find((link) => link.id === id);

    it("links notifications to the Hub's settings in a new tab", () => {
      const link = accountLink(
        build({
          notificationSettingsUrl: "https://admin.example.com/notifications",
        }),
        "notifications",
      );

      expect(link).toMatchObject({
        to: "https://admin.example.com/notifications",
        external: true,
        label: "settings:notifications",
        icon: Bell,
      });
    });

    it("offers no notification settings without the Hub's URL", () => {
      expect(accountLink(build(), "notifications")).toBeUndefined();
      expect(build().account.links.map((link) => link.id)).toEqual([
        "information",
        "preferences",
        "security",
        "developer",
      ]);
    });

    it("only offers project integrations to people who can manage them", () => {
      const sections = (canManageIntegrations: boolean) =>
        build({
          canManageIntegrations,
          projects: [{ id: "p1", name: "Pool" }],
        }).projects[0]?.links.map((link) => link.id);

      expect(sections(true)).toContain("project-p1-integrations");
      expect(sections(false)).toEqual([
        "project-p1-general",
        "project-p1-workflow",
        "project-p1-custom-fields",
        "project-p1-visibility",
        "project-p1-calendar",
      ]);
    });
  });
});
