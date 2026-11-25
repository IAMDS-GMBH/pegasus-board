import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useIsTaskOverdue } from "./use-is-task-overdue";

// Pegasus fork (PEGA-66): an open board turns a card red when the Hub's
// deadline passes, without new task data arriving.
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useIsTaskOverdue", () => {
  it("turns true when the due moment passes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-25T12:00:00.000Z"));
    const task = { dueDate: "2026-11-25T12:00:30.000Z", status: "to-do" };
    const { result } = renderHook(() => useIsTaskOverdue(task, false));
    expect(result.current).toBe(false);

    act(() => vi.advanceTimersByTime(60_000));

    expect(result.current).toBe(true);
  });

  it("keeps no timer for cards without a running due date", () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() =>
      useIsTaskOverdue({ dueDate: null, status: "to-do" }, false),
    );
    expect(vi.getTimerCount()).toBe(0);
    unmount();
  });

  it("stops the clock when the last card unmounts", () => {
    vi.useFakeTimers();
    const task = { dueDate: "2099-01-01T00:00:00.000Z", status: "to-do" };
    const first = renderHook(() => useIsTaskOverdue(task, false));
    const second = renderHook(() => useIsTaskOverdue(task, false));
    expect(vi.getTimerCount()).toBe(1);

    first.unmount();
    second.unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
