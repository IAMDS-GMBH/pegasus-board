import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type Task from "@/types/task";
import TaskCardContextMenuContent from "./task-card-context-menu-content";

const duplicateTask = vi.fn();
const canCreateTasks = vi.fn(() => true);
const canMoveTasks = vi.fn(() => true);
const canMoveLocked = vi.fn(() => false);
let columnsData: unknown[] = [];
vi.mock("@/hooks/use-can-move-locked-columns", () => ({
  useCanMoveLockedColumns: () => canMoveLocked(),
}));
vi.mock("@/hooks/mutations/task/use-duplicate-task", () => ({
  useDuplicateTask: () => ({ mutate: duplicateTask }),
}));

afterEach(() => {
  canCreateTasks.mockReturnValue(true);
  canMoveLocked.mockReturnValue(false);
  columnsData = [];
  cleanup();
  vi.clearAllMocks();
});

vi.mock("@/components/ui/context-menu", () => ({
  ContextMenuContent: ({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element => <div>{children}</div>,
  ContextMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }): React.JSX.Element => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  ContextMenuSeparator: (): React.JSX.Element => <div />,
  ContextMenuSub: ({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element => <div>{children}</div>,
  ContextMenuSubContent: ({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element => <div>{children}</div>,
  ContextMenuSubTrigger: ({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element => <div>{children}</div>,
  ContextMenuCheckboxItem: ({
    children,
    disabled,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
  }): React.JSX.Element => (
    <div data-disabled={disabled ? "true" : undefined}>{children}</div>
  ),
}));

vi.mock("@/hooks/queries/column/use-get-columns", () => ({
  useGetColumns: () => ({
    data: columnsData,
  }),
}));

vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({
    useGetActiveWorkspaceUsers: () => ({
      data: { members: [] },
    }),
  }),
);

vi.mock("@/hooks/queries/workspace-users/use-get-project-members", () => ({
  default: () => ({ data: [] }),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => ({ getQueryData: () => [] }),
}));

vi.mock("@/hooks/mutations/task/use-update-task", () => ({
  useUpdateTask: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/mutations/task/use-update-task-assignee", () => ({
  useUpdateTaskAssignee: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/mutations/task/use-update-task-description", () => ({
  useUpdateTaskDescription: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/mutations/task/use-update-task-due-date", () => ({
  useUpdateTaskDueDate: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/mutations/task/use-update-task-status", () => ({
  useUpdateTaskStatus: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/mutations/task/use-update-task-status-priority", () => ({
  useUpdateTaskPriority: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/mutations/task/use-update-task-title", () => ({
  useUpdateTaskTitle: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canCreateTasks,
    canMoveTasks,
    canUpdateTasks: () => true,
    canDeleteTasks: () => true,
    canAssignTasks: () => true,
  }),
}));

vi.mock("@/store/project", () => ({
  default: () => ({
    project: {
      columns: [],
    },
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { title?: string }) =>
      options?.title ? `${key}|${options.title}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

const task = {
  id: "task-1",
  title: "Test task",
  number: 1,
  description: null,
  status: "to-do",
  priority: null,
  startDate: null,
  dueDate: null,
  position: 1,
  createdAt: "2026-08-05T00:00:00.000Z",
  userId: null,
  assigneeId: null,
  assigneeName: null,
  projectId: "project-1",
} as const satisfies Task;

const taskCardContext = {
  projectId: "project-1",
  worskpaceId: "workspace-1",
};

function renderTask(taskToRender: Task) {
  render(
    <TaskCardContextMenuContent
      task={taskToRender}
      taskCardContext={taskCardContext}
      onDeleteClick={vi.fn()}
    />,
  );
}

describe("TaskCardContextMenuContent", () => {
  it("hides Mark as planned for planned tasks", () => {
    renderTask({
      ...task,
      status: "planned",
    });

    expect(
      screen.queryByText("tasks:actions.markAsPlanned"),
    ).not.toBeInTheDocument();
  });

  it("shows Mark as planned for tasks that are not planned", () => {
    renderTask(task);

    expect(screen.getByText("tasks:actions.markAsPlanned")).toBeInTheDocument();
  });
});

it("duplicates using the localized title suffix", () => {
  renderTask(task);
  fireEvent.click(
    screen.getByRole("button", { name: "tasks:actions.duplicate" }),
  );
  expect(duplicateTask).toHaveBeenCalledWith({
    taskId: task.id,
    title: `tasks:duplicate.titleSuffix|${task.title}`,
  });
});
it("hides duplication without task-create permission", () => {
  canCreateTasks.mockReturnValue(false);
  renderTask(task);
  expect(screen.queryByText("tasks:actions.duplicate")).toBeNull();
});

// Pegasus fork (PEGA-142): status, archive and planned move the card between
// columns, which needs its own right; editing the card stays possible.
it("hides status, archive and planned without canMoveTasks", () => {
  canMoveTasks.mockReturnValue(false);
  renderTask(task);
  expect(screen.queryByText("tasks:status.label")).toBeNull();
  expect(screen.queryByText("tasks:actions.archive")).toBeNull();
  expect(screen.queryByText("tasks:actions.markAsPlanned")).toBeNull();
  expect(screen.getByText("tasks:priority.label")).toBeInTheDocument();
  canMoveTasks.mockReturnValue(true);
});

// Pegasus fork (PEGA-170): no status change into or out of a locked column,
// and no copy into one, for users the API would refuse.
describe("locked columns", () => {
  const lockedColumns = [
    {
      slug: "eingang",
      name: "Eingang",
      icon: null,
      isFinal: false,
      isLocked: true,
    },
    {
      slug: "to-do",
      name: "Unbearbeitet",
      icon: null,
      isFinal: false,
      isLocked: false,
    },
  ];
  const statusItem = (name: string) =>
    screen.getByText(name).closest("div[data-disabled], div");

  it("disables a locked column as status", () => {
    columnsData = lockedColumns;
    render(
      <TaskCardContextMenuContent
        task={task}
        taskCardContext={{ projectId: "project-1", worskpaceId: "ws-1" }}
        onDeleteClick={vi.fn()}
      />,
    );

    expect(statusItem("Eingang")).toHaveAttribute("data-disabled", "true");
    expect(statusItem("Unbearbeitet")).not.toHaveAttribute("data-disabled");
  });

  it("offers no other status and no copy for a card in a locked column", () => {
    columnsData = lockedColumns;
    render(
      <TaskCardContextMenuContent
        task={{ ...task, status: "eingang" }}
        taskCardContext={{ projectId: "project-1", worskpaceId: "ws-1" }}
        onDeleteClick={vi.fn()}
      />,
    );

    expect(statusItem("Unbearbeitet")).toHaveAttribute("data-disabled", "true");
    expect(screen.queryByText("tasks:actions.duplicate")).toBeNull();
  });
});
