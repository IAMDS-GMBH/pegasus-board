import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ProjectProgress } from "./project-progress";

// Pegasus fork (PEGA-142): project figures need REPORTING_VIEW where the Hub
// governs; without it the API sends no statistics and the sidebar shows none.

const permissions = vi.hoisted(() => ({ canViewReports: vi.fn(() => true) }));

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => permissions,
}));

afterEach(cleanup);

describe("ProjectProgress", () => {
  it("shows the progress with canViewReports", () => {
    const { container } = render(<ProjectProgress percentage={40} />);

    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("shows nothing without canViewReports", () => {
    permissions.canViewReports.mockReturnValueOnce(false);
    const { container } = render(<ProjectProgress percentage={40} />);

    expect(container).toBeEmptyDOMElement();
  });
});
