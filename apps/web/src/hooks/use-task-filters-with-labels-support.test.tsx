import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { useTaskFiltersWithLabelsSupport } from "./use-task-filters-with-labels-support";

const getCustomFieldValuesByProject = vi.hoisted(() => vi.fn());
vi.mock("@/fetchers/custom-field/get-custom-field-values-by-project", () => ({
  default: getCustomFieldValuesByProject,
}));

const IGNORE_STATUS = ["status"] as const;

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function createWrapper() {
  const queryClient = createTestQueryClient();

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useTaskFiltersWithLabelsSupport", () => {
  const storageKey = "kaneo:board-filters:project-1";

  beforeEach(() => {
    window.localStorage.clear();
    getCustomFieldValuesByProject.mockReset();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("restores persisted label filters from storage and matches tasks from project data", async () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ labels: ["label-bug"] }),
    );

    const project = {
      id: "project-1",
      name: "Project",
      slug: "PROJ",
      icon: null,
      description: null,
      isPublic: false,
      createdAt: "2026-04-16T00:00:00.000Z",
      updatedAt: "2026-04-16T00:00:00.000Z",
      workspaceId: "workspace-1",
      columns: [
        {
          id: "todo",
          slug: "todo",
          name: "Todo",
          icon: null,
          isFinal: false,
          tasks: [
            {
              id: "task-1",
              title: "Bug task",
              number: 1,
              description: null,
              status: "todo",
              priority: null,
              startDate: null,
              dueDate: null,
              position: 0,
              createdAt: "2026-04-16T00:00:00.000Z",
              updatedAt: "2026-04-16T00:00:00.000Z",
              userId: null,
              assigneeId: null,
              assigneeName: null,
              assigneeImage: null,
              projectId: "project-1",
              labels: [
                {
                  id: "label-bug",
                  name: "bug",
                  color: "red",
                },
              ],
              externalLinks: [],
            },
            {
              id: "task-2",
              title: "Other task",
              number: 2,
              description: null,
              status: "todo",
              priority: null,
              startDate: null,
              dueDate: null,
              position: 1,
              createdAt: "2026-04-16T00:00:00.000Z",
              updatedAt: "2026-04-16T00:00:00.000Z",
              userId: null,
              assigneeId: null,
              assigneeName: null,
              assigneeImage: null,
              projectId: "project-1",
              labels: [],
              externalLinks: [],
            },
          ],
        },
      ],
      plannedTasks: [],
      archivedTasks: [],
    };

    const { result } = renderHook(
      () => useTaskFiltersWithLabelsSupport(project, "project-1"),
      {
        wrapper: createWrapper(),
      },
    );

    await waitFor(() => {
      expect(result.current.filters.labels).toEqual(["label-bug"]);
    });

    expect(result.current.filteredProject?.columns[0]?.tasks).toHaveLength(1);
    expect(result.current.filteredProject?.columns[0]?.tasks[0]?.id).toBe(
      "task-1",
    );
  });

  // Pegasus fork (PEGA-89): the matcher must not depend on the per-task cache
  // that only exists for opened cards.
  it("filters unopened cards by custom field from the project-wide values", async () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ customFields: { paket: ["P2"] } }),
    );
    const value = (taskId: string, raw: string, fieldType = "dropdown") => ({
      id: `${taskId}-paket`,
      taskId,
      fieldId: "paket",
      value: raw,
      fieldName: "Paket",
      fieldPosition: 0,
      fieldType,
      fieldOptions: null,
    });
    getCustomFieldValuesByProject.mockResolvedValue([
      value("task-1", "P1"),
      value("task-2", "P2"),
      value("task-3", JSON.stringify(["P2", "P3"]), "multiselect"),
    ]);
    const taskOf = (id: string) => ({
      id,
      title: id,
      number: 1,
      description: null,
      status: "todo",
      priority: null,
      startDate: null,
      dueDate: null,
      position: 0,
      createdAt: "2026-04-16T00:00:00.000Z",
      updatedAt: "2026-04-16T00:00:00.000Z",
      userId: null,
      assigneeId: null,
      assigneeName: null,
      assigneeImage: null,
      projectId: "project-1",
      labels: [],
      externalLinks: [],
    });
    const project = {
      id: "project-1",
      name: "Project",
      slug: "PROJ",
      icon: null,
      description: null,
      isPublic: false,
      createdAt: "2026-04-16T00:00:00.000Z",
      updatedAt: "2026-04-16T00:00:00.000Z",
      workspaceId: "workspace-1",
      columns: [
        {
          id: "todo",
          slug: "todo",
          name: "Todo",
          icon: null,
          isFinal: false,
          tasks: [taskOf("task-1"), taskOf("task-2"), taskOf("task-3")],
        },
      ],
      plannedTasks: [],
      archivedTasks: [],
    };

    const { result } = renderHook(
      () => useTaskFiltersWithLabelsSupport(project, "project-1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(
        result.current.filteredProject?.columns[0]?.tasks.map(
          (task) => task.id,
        ),
      ).toEqual(["task-2", "task-3"]);
    });
    expect(getCustomFieldValuesByProject).toHaveBeenCalledWith({
      projectId: "project-1",
    });
  });

  it("requests no field values while no custom field filter is active", async () => {
    window.localStorage.setItem(storageKey, JSON.stringify({ labels: ["x"] }));
    renderHook(() => useTaskFiltersWithLabelsSupport(undefined, "project-1"), {
      wrapper: createWrapper(),
    });
    await act(async () => {});
    expect(getCustomFieldValuesByProject).not.toHaveBeenCalled();
  });

  it.each(["#123", "proj-123", "proj-"])(
    "matches a task by its issue identifier when searching for %s",
    (textQuery) => {
      const project = {
        id: "project-1",
        name: "Project",
        slug: "PROJ",
        icon: null,
        description: null,
        isPublic: false,
        createdAt: "2026-04-16T00:00:00.000Z",
        updatedAt: "2026-04-16T00:00:00.000Z",
        workspaceId: "workspace-1",
        columns: [
          {
            id: "todo",
            slug: "todo",
            name: "Todo",
            icon: null,
            isFinal: false,
            tasks: [
              {
                id: "task-123",
                title: "Unrelated title",
                number: 123,
                description: null,
                status: "todo",
                priority: null,
                startDate: null,
                dueDate: null,
                position: 0,
                createdAt: "2026-04-16T00:00:00.000Z",
                updatedAt: "2026-04-16T00:00:00.000Z",
                userId: null,
                assigneeId: null,
                assigneeName: null,
                assigneeImage: null,
                projectId: "project-1",
                labels: [],
                externalLinks: [],
              },
              {
                id: "task-without-number",
                title: "Another unrelated title",
                number: null,
                description: null,
                status: "todo",
                priority: null,
                startDate: null,
                dueDate: null,
                position: 1,
                createdAt: "2026-04-16T00:00:00.000Z",
                updatedAt: "2026-04-16T00:00:00.000Z",
                userId: null,
                assigneeId: null,
                assigneeName: null,
                assigneeImage: null,
                projectId: "project-1",
                labels: [],
                externalLinks: [],
              },
            ],
          },
        ],
        plannedTasks: [],
        archivedTasks: [],
      };

      const { result } = renderHook(
        () => useTaskFiltersWithLabelsSupport(project, "project-1", textQuery),
        {
          wrapper: createWrapper(),
        },
      );

      expect(result.current.filteredProject?.columns[0]?.tasks).toEqual([
        expect.objectContaining({ id: "task-123" }),
      ]);
    },
  );

  it("keeps an ignored status filter stored but out of the backlog", () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ status: ["done"], priority: ["high"] }),
    );
    const planned = {
      id: "planned-1",
      title: "Planned work",
      number: 7,
      description: null,
      status: "planned",
      priority: "high",
      dueDate: null,
      userId: null,
      labels: [],
    };
    const project = {
      id: "project-1",
      slug: "PROJ",
      columns: [],
      plannedTasks: [planned],
      archivedTasks: [],
    } as unknown as Parameters<typeof useTaskFiltersWithLabelsSupport>[0];

    const { result } = renderHook(
      () =>
        useTaskFiltersWithLabelsSupport(
          project,
          "project-1",
          "",
          undefined,
          IGNORE_STATUS,
        ),
      { wrapper: createWrapper() },
    );

    expect(result.current.filters.status).toBeNull();
    expect(result.current.activeFilterCount).toBe(1);
    expect(result.current.filteredProject?.plannedTasks).toHaveLength(1);

    act(() => result.current.clearFilters());

    expect(JSON.parse(window.localStorage.getItem(storageKey) ?? "{}")).toEqual(
      expect.objectContaining({ status: ["done"], priority: null }),
    );
  });
});
