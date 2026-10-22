import { type RefObject, useEffect, useMemo, useState } from "react";
import useBulkSelectionStore from "@/store/bulk-selection";

export const PROGRESSIVE_PAGE_SIZE = 40;

/**
 * Pegasus fork: mounting every card of a 1000-task board blocks the main
 * thread for about a second, so a column renders its cards in pages and adds
 * the next page when the sentinel scrolls near. The keyboard-focused card is
 * always included so arrow navigation can reach any task.
 */
export function useProgressiveTasks<T extends { id: string }>(
  tasks: T[],
  sentinel: RefObject<HTMLElement | null>,
) {
  const [limit, setLimit] = useState(PROGRESSIVE_PAGE_SIZE);
  const focusedIndex = useBulkSelectionStore((state) =>
    state.focusedTaskId
      ? tasks.findIndex((task) => task.id === state.focusedTaskId)
      : -1,
  );
  // Without IntersectionObserver nothing could load the rest.
  const count =
    typeof IntersectionObserver === "undefined"
      ? tasks.length
      : Math.max(limit, focusedIndex + 1);
  const hasMore = count < tasks.length;

  useEffect(() => {
    const element = sentinel.current;
    if (!hasMore || !element) return;
    // A fresh observer per page reports at once, so a tall viewport keeps
    // filling until the sentinel leaves the preload margin.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting))
          setLimit(
            (current) => Math.max(current, count) + PROGRESSIVE_PAGE_SIZE,
          );
      },
      {
        root: element.closest("[data-column-scroll]"),
        rootMargin: "600px 0px",
      },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [count, hasMore, sentinel]);

  const visibleTasks = useMemo(
    () => (hasMore ? tasks.slice(0, count) : tasks),
    [tasks, count, hasMore],
  );
  return { visibleTasks, hasMore };
}
