// Pegasus fork (PEGA-89): the server filters the board query should send.
// Kept outside the query key: the realtime hook and drag-and-drop patch
// `["tasks", projectId]` directly, and other observers of that key (task
// crumb, relations) must fetch with the same filters as the board.
import type { QueryClient } from "@tanstack/react-query";
import type { TaskServerFilters } from "./task-filters/server-filters";

const registry = new WeakMap<QueryClient, Map<string, TaskServerFilters>>();

export function setBoardServerFilters(
  client: QueryClient,
  projectId: string,
  filters: TaskServerFilters | null,
) {
  const entries = registry.get(client) ?? new Map<string, TaskServerFilters>();
  registry.set(client, entries);
  if (filters) entries.set(projectId, filters);
  else entries.delete(projectId);
}

export function getBoardServerFilters(
  client: QueryClient,
  projectId: string,
): TaskServerFilters | null {
  return registry.get(client)?.get(projectId) ?? null;
}
