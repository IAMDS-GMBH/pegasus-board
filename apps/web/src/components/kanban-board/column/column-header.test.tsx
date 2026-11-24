import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import type { ProjectWithTasks } from "@/types/project";
import { ColumnHeader } from "./column-header";
const m = vi.hoisted(() => ({
  project: undefined as ProjectWithTasks | undefined,
  archive: {} as {
    onConfirm?: () => void;
    disabled?: boolean;
    taskCount?: number;
  },
  mutate: vi.fn(),
  setProject: vi.fn(),
  canMoveTasks: vi.fn(() => true),
  canMoveLocked: vi.fn(() => false),
}));
vi.mock("@/hooks/use-can-move-locked-columns", () => ({
  useCanMoveLockedColumns: () => m.canMoveLocked(),
}));
// Pegasus fork (PEGA-142): archiving goes through the status route, which
// needs only LEAD_MOVE_STAGE, not the full update and its LEAD_EDIT.
vi.mock("@/hooks/mutations/task/use-update-task-status", () => ({
  useUpdateTaskStatus: () => ({ mutate: m.mutate }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canUpdateTasks: () => true,
    canCreateTasks: () => true,
    canMoveTasks: m.canMoveTasks,
  }),
}));
vi.mock("@/store/project", () => ({
  default: () => ({ project: m.project, setProject: m.setProject }),
}));
vi.mock("@/components/shared/modals/create-task-modal", () => ({
  default: () => null,
}));
vi.mock("../../shared/modals/archive-tasks-modal", () => ({
  ArchiveTasksModal: (props: typeof m.archive) => {
    m.archive = props;
    return null;
  },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("prevents archive confirmation while the board is partial and uses the completed column afterward", () => {
  const column = {
    id: "done",
    name: "Done",
    slug: "done",
    isFinal: true,
    tasks: [{ id: "a" }],
  } as unknown as ProjectWithTasks["columns"][number];
  m.project = { id: "p", columns: [column] } as ProjectWithTasks;
  const { rerender } = render(<ColumnHeader column={column} />);
  fireEvent.click(screen.getByTitle(/archiveAllTooltip/));
  rerender(<ColumnHeader column={column} disableCollectionActions />);
  expect(screen.getByTitle(/archiveAllTooltip/).hasAttribute("disabled")).toBe(
    true,
  );
  expect(m.archive.disabled).toBe(true);
  act(() => m.archive.onConfirm?.());
  expect(m.mutate).not.toHaveBeenCalled();
  expect(m.setProject).not.toHaveBeenCalled();
  const complete = {
    ...column,
    tasks: [...column.tasks, { id: "b" }],
  } as typeof column;
  m.project = { ...m.project, columns: [complete] };
  rerender(<ColumnHeader column={complete} />);
  expect(m.archive.taskCount).toBe(2);
  act(() => m.archive.onConfirm?.());
  expect(m.mutate).toHaveBeenCalledTimes(2);
  expect(m.mutate).toHaveBeenCalledWith(
    expect.objectContaining({ id: "a", status: "archived" }),
  );
  expect(m.setProject).toHaveBeenCalledOnce();
});

// Pegasus fork (PEGA-142): archiving moves the cards out of the column.
it("offers no archive-all without canMoveTasks", () => {
  m.canMoveTasks.mockReturnValueOnce(false);
  const column = {
    id: "done",
    name: "Done",
    slug: "done",
    isFinal: true,
    tasks: [{ id: "a" }],
  } as unknown as ProjectWithTasks["columns"][number];
  m.project = { id: "p", columns: [column] } as ProjectWithTasks;
  render(<ColumnHeader column={column} />);

  expect(screen.queryByTitle(/archiveAllTooltip/)).toBeNull();
});

// Pegasus fork (PEGA-170): a locked column says it is technical and offers no
// new card to users the API would refuse.
it("shows the lock hint and offers no new card in a locked column", () => {
  const column = {
    id: "eingang",
    name: "Eingang",
    slug: "eingang",
    isFinal: false,
    isLocked: true,
    tasks: [],
  } as unknown as ProjectWithTasks["columns"][number];
  m.project = { id: "p", columns: [column] } as ProjectWithTasks;

  const { rerender } = render(<ColumnHeader column={column} />);
  expect(
    screen.getByRole("img", { name: "tasks:kanban.lockedHint" }),
  ).toBeInTheDocument();
  expect(screen.queryByTitle("tasks:kanban.addTask")).toBeNull();

  m.canMoveLocked.mockReturnValue(true);
  rerender(<ColumnHeader column={column} />);
  expect(screen.getByTitle("tasks:kanban.addTask")).toBeInTheDocument();
  m.canMoveLocked.mockReturnValue(false);
});

it("shows no lock hint on an unlocked column", () => {
  const column = {
    id: "unbearbeitet",
    name: "Unbearbeitet",
    slug: "unbearbeitet",
    isFinal: false,
    isLocked: false,
    tasks: [],
  } as unknown as ProjectWithTasks["columns"][number];
  m.project = { id: "p", columns: [column] } as ProjectWithTasks;

  render(<ColumnHeader column={column} />);

  expect(
    screen.queryByRole("img", { name: "tasks:kanban.lockedHint" }),
  ).toBeNull();
});
