import type { QueryClient } from "@tanstack/react-query";

// The sidebar count, Home and My tasks read the caller's assigned tasks across
// projects, so any task change can move them even though no board cache does.
export function invalidateMyWork(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ["assigned-tasks"] });
  // Fork (PEGA-66): the start page's overdue block, across projects too.
  void queryClient.invalidateQueries({ queryKey: ["overdue-tasks"] });
  void queryClient.invalidateQueries({ queryKey: ["workspace-activity"] });
}
