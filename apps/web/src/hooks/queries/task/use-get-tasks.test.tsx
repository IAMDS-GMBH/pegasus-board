import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import queryClient from "@/query-client";
import useGetPublicProject from "../project/use-get-public-project";
import { useGetTasks } from "./use-get-tasks";

const getTasks = vi.hoisted(() => vi.fn());
const getPublicProject = vi.hoisted(() => vi.fn());
vi.mock("@/fetchers/task/get-tasks", () => ({ default: getTasks }));
vi.mock("@/fetchers/project/get-public-project", () => ({
  default: getPublicProject,
}));

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
  queryClient.clear();
  getTasks.mockReset();
  getPublicProject.mockReset();
});

describe("useGetTasks", () => {
  it("refreshes a cached public board when revisited", async () => {
    queryClient.setQueryData(["public-project", "public-parent"], {
      columns: [{ tasks: [{ subtaskCounts: { completed: 0, total: 1 } }] }],
    });
    const updated = {
      columns: [{ tasks: [{ subtaskCounts: { completed: 1, total: 1 } }] }],
    };
    getPublicProject.mockResolvedValue(updated);
    const { result } = renderHook(() => useGetPublicProject("public-parent"), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.data).toEqual(updated));
    expect(getPublicProject).toHaveBeenCalledWith(
      { id: "public-parent" },
      expect.any(AbortSignal),
      expect.any(Function),
    );
  });

  it("refreshes cached parent progress on return without a parent socket", async () => {
    const parent = {
      id: "parent-project",
      columns: [
        {
          tasks: [{ id: "parent", subtaskCounts: { completed: 0, total: 1 } }],
        },
      ],
    };
    getTasks.mockResolvedValue(parent);
    const firstVisit = renderHook(() => useGetTasks("parent-project"), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(firstVisit.result.current.data).toEqual(parent));
    firstVisit.unmount();

    // Deleting the child project changes the server while the parent is inactive.
    // No socket event or local invalidation reaches this cached board.
    const updatedParent = {
      ...parent,
      columns: [
        {
          tasks: [{ id: "parent", subtaskCounts: { completed: 0, total: 0 } }],
        },
      ],
    };
    getTasks.mockResolvedValue(updatedParent);
    expect(queryClient.getQueryData(["tasks", "parent-project"])).toEqual(
      parent,
    );
    const returnVisit = renderHook(() => useGetTasks("parent-project"), {
      wrapper: Wrapper,
    });
    await waitFor(() =>
      expect(returnVisit.result.current.data).toEqual(updatedParent),
    );
    expect(getTasks).toHaveBeenCalledTimes(2);
  });
});

// Pegasus fork (PEGA-89)
describe("useGetTasks with server filters", () => {
  const board = { id: "p", columns: [{ tasks: [] }] };

  it("passes the registered filters to the fetcher and refetches on change", async () => {
    getTasks.mockResolvedValue(board);
    const filters = { customFields: { paket: ["P2"] } };
    const hook = renderHook(
      ({ serverFilters }) => useGetTasks("p", { serverFilters }),
      { wrapper: Wrapper, initialProps: { serverFilters: filters } },
    );
    await waitFor(() => expect(hook.result.current.data).toEqual(board));
    expect(getTasks).toHaveBeenCalledTimes(1);
    expect(getTasks.mock.calls[0][3]).toEqual(filters);

    // Same filters, new object: no refetch.
    hook.rerender({ serverFilters: { customFields: { paket: ["P2"] } } });
    await act(async () => {});
    expect(getTasks).toHaveBeenCalledTimes(1);

    const next = { customFields: { paket: ["P3"] }, labels: ["Kampagne A"] };
    hook.rerender({ serverFilters: next });
    await waitFor(() => expect(getTasks).toHaveBeenCalledTimes(2));
    expect(getTasks.mock.calls[1][3]).toEqual(next);
    hook.unmount();
  });

  it("lets another observer of the same key fetch with the board's filters", async () => {
    getTasks.mockResolvedValue(board);
    const filters = { labels: ["Kampagne A"] };
    const boardHook = renderHook(
      () => useGetTasks("p", { serverFilters: filters }),
      {
        wrapper: Wrapper,
      },
    );
    await waitFor(() => expect(boardHook.result.current.data).toEqual(board));
    const other = renderHook(
      () => useGetTasks("p", { refetchOnMount: false }),
      {
        wrapper: Wrapper,
      },
    );
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ["tasks", "p"] });
    });
    expect(getTasks.mock.calls.at(-1)?.[3]).toEqual(filters);
    other.unmount();
    boardHook.unmount();
  });

  it("clears the filters and refetches the whole board when the board unmounts", async () => {
    getTasks.mockResolvedValue(board);
    const boardHook = renderHook(
      () => useGetTasks("p", { serverFilters: { labels: ["A"] } }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(boardHook.result.current.data).toEqual(board));
    const other = renderHook(
      () => useGetTasks("p", { refetchOnMount: false }),
      {
        wrapper: Wrapper,
      },
    );
    boardHook.unmount();
    await waitFor(() => expect(getTasks).toHaveBeenCalledTimes(2));
    expect(getTasks.mock.calls[1][3]).toBeNull();
    other.unmount();
  });

  it("does not refetch when the board mounts without filters", async () => {
    getTasks.mockResolvedValue(board);
    const hook = renderHook(() => useGetTasks("p", { serverFilters: null }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(hook.result.current.data).toEqual(board));
    await act(async () => {});
    expect(getTasks).toHaveBeenCalledTimes(1);
    expect(getTasks.mock.calls[0][3]).toBeNull();
    hook.unmount();
    await act(async () => {});
    expect(getTasks).toHaveBeenCalledTimes(1);
  });
});

it.each(["private", "public"])(
  "does not cache incomplete %s pagination after failure and supports retry",
  async (kind) => {
    const key =
      kind === "private" ? ["tasks", "failed"] : ["public-project", "failed"];
    queryClient.setQueryDefaults(key, { retry: false });
    const fetcher = kind === "private" ? getTasks : getPublicProject;
    fetcher.mockImplementationOnce(async (...args) => {
      args[2]({ id: "failed", columns: [{ tasks: [{ id: "partial" }] }] });
      throw new Error("second page failed");
    });
    const { result } = renderHook(
      () =>
        kind === "private"
          ? useGetTasks("failed")
          : useGetPublicProject("failed"),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(queryClient.getQueryData(key)).toBeUndefined();
    const completed = {
      id: "failed",
      columns: [{ tasks: [{ id: "partial" }, { id: "page-two" }] }],
    };
    fetcher.mockResolvedValue(completed);
    await result.current.refetch();
    await waitFor(() => expect(result.current.data).toEqual(completed));
  },
);

it.each(["create", "delete", "move", "edit"])(
  "replays a local %s invalidation after initial pagination",
  async (operation) => {
    let finish!: (value: unknown) => void;
    const stale = {
      id: "initial",
      columns: [{ tasks: [{ id: "old", title: "Before" }] }],
    };
    const current = {
      id: "initial",
      columns: [
        {
          tasks:
            operation === "delete" || operation === "move"
              ? []
              : [
                  {
                    id: operation === "create" ? "new" : "old",
                    title: "After",
                  },
                ],
        },
      ],
    };
    getTasks
      .mockImplementationOnce((_id, _signal, onProgress) => {
        onProgress(stale);
        return new Promise((resolve) => {
          finish = resolve;
        });
      })
      .mockResolvedValue(current);
    const { result } = renderHook(() => useGetTasks("initial"), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.data).toEqual(stale));
    expect(queryClient.getQueryData(["tasks", "initial"])).toBeUndefined();
    act(() => {
      for (let count = 0; count < 20; count++)
        void queryClient.invalidateQueries({ queryKey: ["tasks", "initial"] });
    });
    act(() => finish(stale));
    await waitFor(() => expect(result.current.data).toEqual(current));
    expect(getTasks).toHaveBeenCalledTimes(2);
  },
);
it("does not restart a cancelled initial board after a queued local invalidation", async () => {
  let finish!: (value: unknown) => void;
  getTasks.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  renderHook(() => useGetTasks("cancelled"), { wrapper: Wrapper });
  await waitFor(() => expect(getTasks).toHaveBeenCalledOnce());
  void queryClient.invalidateQueries({ queryKey: ["tasks", "cancelled"] });
  await queryClient.cancelQueries({ queryKey: ["tasks", "cancelled"] });
  act(() => finish({ id: "cancelled", columns: [] }));
  await Promise.resolve();
  expect(getTasks).toHaveBeenCalledOnce();
  expect(queryClient.getQueryData(["tasks", "cancelled"])).toBeUndefined();
});
