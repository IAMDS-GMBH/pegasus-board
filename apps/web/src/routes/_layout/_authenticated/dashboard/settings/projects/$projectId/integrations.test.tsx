import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { Route } from "./integrations";

const permission = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useParams: () => ({ projectId: "p1" }),
  }),
  Navigate: ({
    to,
    params,
    replace,
  }: {
    to: string;
    params?: Record<string, string>;
    replace?: boolean;
  }) => (
    <div
      data-testid="navigate"
      data-to={to}
      data-project={params?.projectId}
      data-replace={String(replace)}
    />
  ),
}));

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => permission(),
}));

vi.mock("@/components/project/integrations/project-integrations-page", () => ({
  ProjectIntegrationsPage: ({ projectId }: { projectId: string }) => (
    <div data-testid="integrations-page">{projectId}</div>
  ),
}));

const IntegrationsRoute = (Route as unknown as { component: ComponentType })
  .component;

function access(
  overrides: Partial<{
    workspace: object | undefined;
    member: object | undefined;
    isCheckingPermissions: boolean;
    canManageIntegrations: boolean;
  }> = {},
) {
  const { canManageIntegrations = true, ...rest } = overrides;
  permission.mockReturnValue({
    workspace: { id: "w1" },
    member: { role: "admin" },
    isCheckingPermissions: false,
    canManageIntegrations: () => canManageIntegrations,
    ...rest,
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Pegasus fork (PEGA-80): integrations belong to members the Pegasus Hub does
// not govern.
describe("project integrations route", () => {
  it("shows the integrations to people who can manage them", () => {
    access();

    render(<IntegrationsRoute />);

    expect(screen.getByTestId("integrations-page").textContent).toBe("p1");
  });

  it("sends everyone else to the project's general settings", () => {
    access({ canManageIntegrations: false });

    render(<IntegrationsRoute />);

    const navigate = screen.getByTestId("navigate");
    expect(navigate.dataset.to).toBe(
      "/dashboard/settings/projects/$projectId/general",
    );
    expect(navigate.dataset.project).toBe("p1");
    expect(navigate.dataset.replace).toBe("true");
    expect(screen.queryByTestId("integrations-page")).toBeNull();
  });

  it.each([
    ["the workspace", { workspace: undefined }],
    ["the member", { member: undefined }],
    ["the capabilities", { isCheckingPermissions: true }],
  ])("renders nothing while %s load", (_name, loading) => {
    access({ canManageIntegrations: false, ...loading });

    const { container } = render(<IntegrationsRoute />);

    expect(container.innerHTML).toBe("");
  });
});
