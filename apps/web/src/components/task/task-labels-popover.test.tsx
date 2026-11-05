import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type Task from "@/types/task";
import TaskLabelsPopover from "./task-labels-popover";

// Pegasus fork (PEGA-142): putting labels on a card is a lead edit where the
// Hub governs (LEAD_EDIT), separate from managing the workspace's labels.

const permissions = vi.hoisted(() => ({
  canLabelTasks: vi.fn(() => true),
  canUpdateLabels: vi.fn(() => true),
  canCreateLabels: vi.fn(() => true),
}));

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => permissions,
}));
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => (
    <div data-testid="labels-popover">{children}</div>
  ),
  PopoverTrigger: ({ children }: { children: ReactNode }) => children,
  PopoverContent: () => null,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/hooks/mutations/label/use-attach-label-to-task", () => ({
  default: () => ({}),
}));
vi.mock("@/hooks/mutations/label/use-create-label", () => ({
  default: () => ({}),
}));
vi.mock("@/hooks/mutations/label/use-detach-label-from-task", () => ({
  default: () => ({}),
}));
vi.mock("@/hooks/queries/label/use-get-labels-by-task", () => ({
  default: () => ({}),
}));
vi.mock("@/hooks/queries/label/use-get-labels-by-workspace", () => ({
  default: () => ({}),
}));

afterEach(cleanup);

const task = { id: "task-1", projectId: "project-1" } as Task;

function renderPopover() {
  render(
    <TaskLabelsPopover task={task} workspaceId="workspace-1">
      <button type="button">Labels</button>
    </TaskLabelsPopover>,
  );
}

describe("TaskLabelsPopover", () => {
  it("offers the label picker with canLabelTasks", () => {
    renderPopover();

    expect(screen.getByTestId("labels-popover")).toBeInTheDocument();
  });

  it("offers no label picker without canLabelTasks, even with canUpdateLabels", () => {
    permissions.canLabelTasks.mockReturnValueOnce(false);
    renderPopover();

    expect(screen.queryByTestId("labels-popover")).toBeNull();
    expect(screen.getByRole("button", { name: "Labels" })).toBeInTheDocument();
  });
});
