import { useMutation, useQueryClient } from "@tanstack/react-query";
import returnTask from "@/fetchers/task/return-task";
import { invalidateMyWork } from "@/lib/invalidate-my-work";
import type Task from "@/types/task";

// Pegasus fork (PEGA-143): the assignee gives a card back to its unit.
export function useReturnTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (task: Pick<Task, "id" | "projectId">) => returnTask(task.id),
    onSuccess: (_, task) => {
      invalidateMyWork(queryClient);
      // An assigned-only member can no longer read the card: mark it stale
      // without refetching it while the closing view still shows it.
      queryClient.invalidateQueries({
        queryKey: ["task", task.id],
        refetchType: "none",
      });
      queryClient.invalidateQueries({ queryKey: ["tasks", task.projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({
        queryKey: ["activities", task.id],
        refetchType: "none",
      });
    },
  });
}
