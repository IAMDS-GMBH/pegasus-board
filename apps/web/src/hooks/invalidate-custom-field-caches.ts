// Pegasus fork (PEGA-90): refreshes custom field caches after another user's
// change. Only messages with the `customFieldsChanged` hint call this, so
// ordinary task updates don't refetch every field value on the board.
import type { QueryClient } from "@tanstack/react-query";
import { markBoardCacheChanged } from "@/lib/board-cache-version";
import { getBoardServerFilters } from "@/lib/board-server-filters";

export function invalidateCustomFieldCaches(
  queryClient: QueryClient,
  projectId: string,
  message: { type: string; taskId?: string },
) {
  queryClient.invalidateQueries({
    queryKey: ["custom-field-filter-values", projectId],
  });
  if (message.type === "PROJECT_UPDATED") {
    queryClient.invalidateQueries({ queryKey: ["custom-fields", projectId] });
    // Covers the project's card values and every open task's values.
    queryClient.invalidateQueries({ queryKey: ["custom-field-values"] });
    return;
  }
  if (message.taskId)
    queryClient.invalidateQueries({
      queryKey: ["custom-field-values", message.taskId],
    });
  queryClient.invalidateQueries({
    queryKey: ["custom-field-values", projectId],
  });
  // A server-filtered board (PEGA-89) may now gain or lose this task.
  if (getBoardServerFilters(queryClient, projectId)?.customFields) {
    markBoardCacheChanged(queryClient, projectId);
    void queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
  }
}
