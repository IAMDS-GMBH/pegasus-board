import { useSyncExternalStore } from "react";
import { isTaskOverdue } from "@/lib/is-task-overdue";
import { readMinuteClock, subscribeToMinuteClock } from "@/lib/minute-clock";

const subscribeToNothing = () => () => {};

// Pegasus fork (PEGA-66): re-renders a card only when its overdue state flips,
// so a board of a thousand cards does not repaint every minute.
export function useIsTaskOverdue(
  task: { dueDate: string | null; status: string },
  isFinal: boolean,
) {
  const running = Boolean(task.dueDate) && !isFinal;
  return useSyncExternalStore(
    running ? subscribeToMinuteClock : subscribeToNothing,
    () => isTaskOverdue(task, isFinal, new Date(readMinuteClock())),
  );
}
