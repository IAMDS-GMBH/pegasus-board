import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { BulkBar } from "./bulk-bar";

// Pegasus fork (PEGA-142): changing the status, moving to the backlog and
// archiving move cards between columns and need canMoveTasks; editing other
// fields stays with canUpdateTasks.

const permissions = vi.hoisted(() => ({
  edit: true,
  move: false,
  delete: false,
  assign: false,
  labels: false,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("./use-bulk-actions", () => ({
  useBulkActions: () => ({
    count: 1,
    permissions,
    deleteConfirm: { open: false, request: vi.fn() },
  }),
}));
vi.mock("./use-bulk-options", () => ({
  useBulkOptions: () => ({
    columnOptions: [],
    priorityOptions: [],
    memberOptions: [],
    labelOptions: [],
  }),
}));
vi.mock("./use-toolbar-presence", () => ({
  useToolbarPresence: () => ({ mounted: true, hidden: false, displayCount: 1 }),
}));
vi.mock("./use-bulk-selection-keys", () => ({ useBulkSelectionKeys: vi.fn() }));
vi.mock("./bulk-option-popover", () => ({
  BulkOptionPopover: ({ label }: { label: string }) => <span>{label}</span>,
}));
vi.mock("./bulk-due-date-popover", () => ({ BulkDueDatePopover: () => null }));
vi.mock("./bulk-delete-confirm", () => ({ BulkDeleteConfirm: () => null }));
vi.mock("./bulk-action-command", () => ({ BulkActionCommand: () => null }));
vi.mock("./bulk-more-menu", () => ({
  BulkMoreMenu: ({ onArchive }: { onArchive?: () => void }) => (
    <span>{onArchive ? "archive offered" : "no archive"}</span>
  ),
}));
vi.mock("./bar-tooltip", () => ({
  BarTooltip: ({ children }: { children: React.ReactNode }) => children,
}));

afterEach(cleanup);

describe("BulkBar", () => {
  it("offers no status, backlog move or archive without canMoveTasks", () => {
    render(
      <BulkBar
        variant="board"
        selectedTaskIds={new Set(["a"])}
        clearSelection={vi.fn()}
        selectAll={vi.fn()}
        getFocusedTaskId={() => null}
      />,
    );

    expect(screen.queryByText("tasks:status.label")).toBeNull();
    expect(screen.queryByRole("button", { name: /moveToBacklog/i })).toBeNull();
    expect(screen.queryByText("archive offered")).toBeNull();
    expect(screen.getByText("tasks:priority.label")).toBeInTheDocument();
  });
});
