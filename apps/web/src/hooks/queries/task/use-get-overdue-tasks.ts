import { useQuery } from "@tanstack/react-query";
import getOverdueTasks from "@/fetchers/task/get-overdue-tasks";

// Pegasus fork (PEGA-66): refreshed like the assigned tasks, since the start
// page has no project socket and deadlines pass without any task change.
function useGetOverdueTasks(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["overdue-tasks", workspaceId],
    queryFn: () => getOverdueTasks(workspaceId ?? ""),
    enabled: Boolean(workspaceId),
    refetchOnMount: "always",
    refetchInterval: 30_000,
    refetchOnWindowFocus: "always",
  });
}

export default useGetOverdueTasks;
