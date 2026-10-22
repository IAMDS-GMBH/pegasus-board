import { act, renderHook } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import useBulkSelectionStore from "@/store/bulk-selection";
import {
  PROGRESSIVE_PAGE_SIZE,
  useProgressiveTasks,
} from "./use-progressive-tasks";

const tasks = Array.from({ length: 100 }, (_, index) => ({ id: `t${index}` }));
let reportIntersection: (() => void) | undefined;

beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        reportIntersection = () =>
          callback(
            [{ isIntersecting: true } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          );
      }
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  reportIntersection = undefined;
  useBulkSelectionStore.getState().clearFocus();
});

const sentinel = { current: document.createElement("div") };

describe("useProgressiveTasks", () => {
  it("renders the first page and adds the next when the sentinel shows", () => {
    const { result } = renderHook(() => useProgressiveTasks(tasks, sentinel));
    expect(result.current.visibleTasks).toHaveLength(PROGRESSIVE_PAGE_SIZE);
    expect(result.current.hasMore).toBe(true);

    act(() => reportIntersection?.());
    expect(result.current.visibleTasks).toHaveLength(PROGRESSIVE_PAGE_SIZE * 2);
  });

  it("includes the keyboard-focused task", () => {
    useBulkSelectionStore.getState().setFocusedTask("t70");
    const { result } = renderHook(() => useProgressiveTasks(tasks, sentinel));
    expect(result.current.visibleTasks).toHaveLength(71);
  });

  it("returns the column unchanged when it fits on one page", () => {
    const short = tasks.slice(0, 5);
    const { result } = renderHook(() => useProgressiveTasks(short, sentinel));
    expect(result.current.visibleTasks).toBe(short);
    expect(result.current.hasMore).toBe(false);
  });

  it("renders everything without IntersectionObserver", () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("IntersectionObserver", undefined);
    const { result } = renderHook(() => useProgressiveTasks(tasks, sentinel));
    expect(result.current.visibleTasks).toBe(tasks);
  });
});
