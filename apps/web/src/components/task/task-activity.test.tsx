import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { TaskActivity } from "./task-activity";

// Pegasus fork (PEGA-142): commenting edits the lead, so the composer needs
// canUpdateTasks (LEAD_EDIT where the Hub governs, task:update otherwise).

const permissions = vi.hoisted(() => ({ canUpdateTasks: vi.fn(() => true) }));

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => permissions,
}));
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: { id: "user-1" } }),
}));
vi.mock("@/hooks/queries/activity/use-get-activities-by-task-id", () => ({
  default: () => ({ data: [] }),
}));
vi.mock("@/components/activity/comment-input", () => ({
  default: () => <div>comment composer</div>,
}));
vi.mock("@/components/activity", () => ({ default: () => null }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

describe("TaskActivity", () => {
  it("shows the comment composer with canUpdateTasks", () => {
    render(<TaskActivity taskId="task-1" projectId="project-1" />);

    expect(screen.getByText("comment composer")).toBeInTheDocument();
  });

  it("hides the comment composer without canUpdateTasks", () => {
    permissions.canUpdateTasks.mockReturnValueOnce(false);
    render(<TaskActivity taskId="task-1" projectId="project-1" />);

    expect(screen.queryByText("comment composer")).toBeNull();
  });
});
