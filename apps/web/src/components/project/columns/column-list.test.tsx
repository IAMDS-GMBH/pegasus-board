import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { ColumnList } from "@/components/project/columns/column-list";
import { toast } from "@/lib/toast";

const m = vi.hoisted(() => ({
  canManage: true,
  createColumn: vi.fn(),
  updateColumn: vi.fn(),
  deleteColumn: vi.fn(),
  reorderColumns: vi.fn(),
}));

vi.mock("@/lib/i18n", () => ({ i18n: { t: (key: string) => key } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canManageProjects: () => m.canManage }),
}));
vi.mock("@/hooks/queries/column/use-get-columns", () => ({
  useGetColumns: () => ({
    isLoading: false,
    data: [
      {
        id: "c1",
        name: "To Do",
        slug: "to-do",
        icon: null,
        isFinal: false,
        phase: "Eingang und Datenprüfung",
        isLocked: false,
        isRestricted: false,
        position: 0,
      },
      {
        id: "c2",
        name: "Done",
        slug: "done",
        icon: null,
        isFinal: true,
        phase: null,
        isLocked: false,
        isRestricted: false,
        position: 1,
      },
      {
        id: "c3",
        name: "Absage",
        slug: "absage",
        icon: null,
        isFinal: true,
        phase: "Eingang und Datenprüfung",
        isLocked: false,
        isRestricted: false,
        position: 2,
      },
    ],
  }),
}));
vi.mock("@/hooks/mutations/column/use-create-column", () => ({
  useCreateColumn: () => ({ mutateAsync: m.createColumn }),
}));
vi.mock("@/hooks/mutations/column/use-update-column", () => ({
  useUpdateColumn: () => ({ mutateAsync: m.updateColumn }),
}));
vi.mock("@/hooks/mutations/column/use-delete-column", () => ({
  useDeleteColumn: () => ({ mutateAsync: m.deleteColumn, isPending: false }),
}));
vi.mock("@/hooks/mutations/column/use-reorder-columns", () => ({
  useReorderColumns: () => ({ mutateAsync: m.reorderColumns }),
}));

describe("ColumnList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.canManage = true;
    for (const fn of [m.createColumn, m.updateColumn, m.deleteColumn]) {
      fn.mockResolvedValue({});
    }
    Object.defineProperty(Element.prototype, "getAnimations", {
      configurable: true,
      value: () => [],
    });
  });
  afterEach(cleanup);

  it("renames on Enter and reverts a blank name without saving", async () => {
    render(<ColumnList projectId="p1" />);
    const [name] = screen.getAllByRole("textbox", {
      name: "settings:columnEditor.renameAria",
    }) as HTMLInputElement[];

    fireEvent.change(name, { target: { value: "   " } });
    fireEvent.blur(name);
    expect(name.value).toBe("To Do");
    expect(m.updateColumn).not.toHaveBeenCalled();

    fireEvent.change(name, { target: { value: "  Backlog " } });
    fireEvent.keyDown(name, { key: "Enter" });
    fireEvent.blur(name);
    await waitFor(() =>
      expect(m.updateColumn).toHaveBeenCalledWith({
        id: "c1",
        projectId: "p1",
        data: { name: "Backlog" },
      }),
    );
  });

  it("toggles the done column", async () => {
    render(<ColumnList projectId="p1" />);
    const [todoSwitch] = screen.getAllByRole("switch", {
      name: "settings:columnEditor.markDoneAria",
    });
    fireEvent.click(todoSwitch);
    await waitFor(() =>
      expect(m.updateColumn).toHaveBeenCalledWith({
        id: "c1",
        projectId: "p1",
        data: { isFinal: true },
      }),
    );
  });

  it("asks before deleting and keeps the error toast", async () => {
    m.deleteColumn.mockRejectedValue(
      new Error("Cannot delete column that contains tasks."),
    );
    render(<ColumnList projectId="p1" />);
    fireEvent.click(
      screen.getAllByRole("button", {
        name: "settings:columnEditor.deleteAria",
      })[0],
    );
    const confirm = await screen.findByRole("alertdialog");
    expect(
      within(confirm).getByText("settings:columnEditor.deleteDescription"),
    ).toBeInTheDocument();
    expect(m.deleteColumn).not.toHaveBeenCalled();

    fireEvent.click(
      within(confirm).getByRole("button", {
        name: "settings:columnEditor.deleteConfirm",
      }),
    );
    await waitFor(() =>
      expect(m.deleteColumn).toHaveBeenCalledWith({
        id: "c1",
        projectId: "p1",
      }),
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Cannot delete column that contains tasks.",
      ),
    );
  });

  it("adds a column from the inline row", async () => {
    render(<ColumnList projectId="p1" />);
    fireEvent.click(
      screen.getByRole("button", { name: "settings:columnEditor.addColumn" }),
    );
    const input = screen.getByRole("textbox", {
      name: "settings:columnEditor.newColumnPlaceholder",
    });
    fireEvent.change(input, { target: { value: " Review " } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(m.createColumn).toHaveBeenCalledWith({
        projectId: "p1",
        data: { name: "Review", icon: "Circle" },
      }),
    );
    await waitFor(() => expect(input).toHaveValue(""));
  });

  // Pegasus fork (PEGA-170): phase and lock are column settings.
  it("saves a phase typed into a column row and clears it when blank", async () => {
    render(<ColumnList projectId="p1" />);
    const [todo, done] = screen.getAllByRole("combobox", {
      name: "settings:columnEditor.phaseAria",
    }) as HTMLInputElement[];
    expect(todo.value).toBe("Eingang und Datenprüfung");

    fireEvent.change(done, { target: { value: "  Abschluss " } });
    fireEvent.keyDown(done, { key: "Enter" });
    fireEvent.blur(done);
    await waitFor(() =>
      expect(m.updateColumn).toHaveBeenCalledWith({
        id: "c2",
        projectId: "p1",
        data: { phase: "Abschluss" },
      }),
    );

    fireEvent.change(todo, { target: { value: "  " } });
    fireEvent.blur(todo);
    await waitFor(() =>
      expect(m.updateColumn).toHaveBeenCalledWith({
        id: "c1",
        projectId: "p1",
        data: { phase: null },
      }),
    );
  });

  it("offers the project's existing phases as suggestions", () => {
    const { container } = render(<ColumnList projectId="p1" />);
    const [input] = screen.getAllByRole("combobox", {
      name: "settings:columnEditor.phaseAria",
    });
    const list = container.querySelector(
      `datalist#${input.getAttribute("list")}`,
    );

    expect(
      [...(list?.querySelectorAll("option") ?? [])].map((o) => o.value),
    ).toEqual(["Eingang und Datenprüfung"]);
  });

  it("toggles the locked column", async () => {
    render(<ColumnList projectId="p1" />);
    const [todoLock] = screen.getAllByRole("switch", {
      name: "settings:columnEditor.markLockedAria",
    });
    fireEvent.click(todoLock);
    await waitFor(() =>
      expect(m.updateColumn).toHaveBeenCalledWith({
        id: "c1",
        projectId: "p1",
        data: { isLocked: true },
      }),
    );
  });

  // Pegasus fork (PEGA-170, Nachtrag 26.11.2026).
  it("toggles the restricted column", async () => {
    render(<ColumnList projectId="p1" />);
    const [todoRestricted] = screen.getAllByRole("switch", {
      name: "settings:columnEditor.markRestrictedAria",
    });
    fireEvent.click(todoRestricted);
    await waitFor(() =>
      expect(m.updateColumn).toHaveBeenCalledWith({
        id: "c1",
        projectId: "p1",
        data: { isRestricted: true },
      }),
    );
  });

  it("adds a restricted column", async () => {
    render(<ColumnList projectId="p1" />);
    fireEvent.click(
      screen.getByRole("button", { name: "settings:columnEditor.addColumn" }),
    );
    fireEvent.click(
      screen.getByRole("switch", {
        name: "settings:columnEditor.newColumnRestrictedAria",
      }),
    );
    const input = screen.getByRole("textbox", {
      name: "settings:columnEditor.newColumnPlaceholder",
    });
    fireEvent.change(input, { target: { value: "Manuelle Anreicherung" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(m.createColumn).toHaveBeenCalledWith({
        projectId: "p1",
        data: {
          name: "Manuelle Anreicherung",
          icon: "Circle",
          isRestricted: true,
        },
      }),
    );
  });

  it("adds a column with a phase and the lock", async () => {
    render(<ColumnList projectId="p1" />);
    fireEvent.click(
      screen.getByRole("button", { name: "settings:columnEditor.addColumn" }),
    );
    fireEvent.change(
      screen.getByRole("combobox", {
        name: "settings:columnEditor.newColumnPhaseAria",
      }),
      { target: { value: " Eingang und Datenprüfung " } },
    );
    fireEvent.click(
      screen.getByRole("switch", {
        name: "settings:columnEditor.newColumnLockedAria",
      }),
    );
    const input = screen.getByRole("textbox", {
      name: "settings:columnEditor.newColumnPlaceholder",
    });
    fireEvent.change(input, { target: { value: "Pegasus-Pool" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(m.createColumn).toHaveBeenCalledWith({
        projectId: "p1",
        data: {
          name: "Pegasus-Pool",
          icon: "Circle",
          phase: "Eingang und Datenprüfung",
          isLocked: true,
        },
      }),
    );
  });

  it("is read-only without permission to manage projects", () => {
    m.canManage = false;
    render(<ColumnList projectId="p1" />);
    expect(
      screen.queryByRole("button", { name: "settings:columnEditor.addColumn" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: "settings:columnEditor.deleteAria",
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "settings:columnEditor.dragAria" }),
    ).toBeNull();
    for (const toggle of screen.getAllByRole("switch")) {
      expect(toggle).toHaveAttribute("aria-disabled", "true");
    }
    expect(screen.getAllByRole("switch")).toHaveLength(9);
    for (const phase of screen.getAllByRole("combobox", {
      name: "settings:columnEditor.phaseAria",
    })) {
      expect(phase).toHaveAttribute("readonly");
    }
  });
});
