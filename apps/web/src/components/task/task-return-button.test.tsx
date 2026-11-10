import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { TaskReturnButton } from "./task-return-button";

const mocks = vi.hoisted(() => ({
  user: { id: "bearbeiter" } as { id: string } | null,
  canReturnTasks: vi.fn(),
  returnTask: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  useAuth: () => ({ user: mocks.user }),
}));
vi.mock("@/hooks/mutations/task/use-return-task", () => ({
  useReturnTask: () => ({ mutateAsync: mocks.returnTask, isPending: false }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canReturnTasks: mocks.canReturnTasks,
    isCheckingPermissions: false,
  }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { error: mocks.error, success: mocks.success },
}));

const task = { id: "task-1", projectId: "project-1", userId: "bearbeiter" };
const button = () =>
  screen.queryByRole("button", { name: "tasks:return.action" });

beforeEach(() => {
  mocks.user = { id: "bearbeiter" };
  mocks.canReturnTasks.mockReturnValue(true);
  mocks.returnTask.mockResolvedValue({ ...task, userId: null });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Pegasus fork (PEGA-143).
describe("TaskReturnButton", () => {
  it("returns the assignee's own task and closes the view", async () => {
    const onReturned = vi.fn();
    render(<TaskReturnButton task={task} onReturned={onReturned} />);

    fireEvent.click(button() as HTMLButtonElement);

    await waitFor(() => expect(onReturned).toHaveBeenCalledOnce());
    expect(mocks.returnTask).toHaveBeenCalledWith(task);
    expect(mocks.success).toHaveBeenCalledWith("tasks:return.success");
  });

  it("is hidden from anyone but the assignee", () => {
    mocks.user = { id: "fuehrungskraft" };
    render(<TaskReturnButton task={task} />);

    expect(button()).toBeNull();
  });

  it("is hidden without the right to return", () => {
    mocks.canReturnTasks.mockReturnValue(false);
    render(<TaskReturnButton task={task} />);

    expect(button()).toBeNull();
  });

  it("keeps the view open and reports a failed return", async () => {
    const onReturned = vi.fn();
    mocks.returnTask.mockRejectedValue(new Error("Insufficient permissions"));
    render(<TaskReturnButton task={task} onReturned={onReturned} />);

    fireEvent.click(button() as HTMLButtonElement);

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith("Insufficient permissions"),
    );
    expect(onReturned).not.toHaveBeenCalled();
  });
});
