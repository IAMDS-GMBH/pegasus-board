import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { BoardFilters } from "./use-task-filters";
import { useOverdueFilterFromSearch } from "./use-overdue-filter-from-search";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const filters: BoardFilters = {
  status: null,
  priority: ["high"],
  assignee: null,
  dueDate: ["noDueDate"],
  labels: null,
  customFields: null,
  negated: ["dueDate", "priority"],
};

// Pegasus fork (PEGA-66): "alle anzeigen" on the start page opens the board
// with `?filter=overdue`; the board stores the filter like any other.
describe("useOverdueFilterFromSearch", () => {
  it("sets the overdue filter, keeps the others and drops the search param", () => {
    const setFilters = vi.fn();

    renderHook(() => useOverdueFilterFromSearch("overdue", setFilters));

    const update = setFilters.mock.calls[0]?.[0] as (
      prev: BoardFilters,
    ) => BoardFilters;
    expect(update(filters)).toEqual({
      ...filters,
      dueDate: ["overdue"],
      negated: ["priority"],
    });
    const [{ search, replace }] = navigate.mock.calls[0] as [
      { search: (prev: object) => object; replace: boolean },
    ];
    expect(search({ taskId: "t", filter: "overdue" })).toEqual({
      taskId: "t",
      filter: undefined,
    });
    expect(replace).toBe(true);
  });

  it("leaves the filters alone without the search param", () => {
    const setFilters = vi.fn();

    renderHook(() => useOverdueFilterFromSearch(undefined, setFilters));

    expect(setFilters).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
