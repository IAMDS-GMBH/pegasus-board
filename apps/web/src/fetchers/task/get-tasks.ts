import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";
import type { TaskServerFilters } from "@/lib/task-filters/server-filters";
import { loadBoardPages } from "./load-board-pages";

async function getTasks(
  projectId: string,
  signal?: AbortSignal,
  onProgress?: (
    board: InferResponseType<
      (typeof client)["task"]["tasks"][":projectId"]["$get"],
      200
    >["data"],
  ) => void,
  // Pegasus fork (PEGA-89): filters the API applies before pagination.
  filters?: TaskServerFilters | null,
) {
  return loadBoardPages(
    async (page, relatedPage) => {
      const response = await client.task.tasks[":projectId"].$get(
        {
          param: { projectId },
          query: {
            page: String(page),
            limit: "100",
            ...(relatedPage ? { relatedPage: String(relatedPage) } : {}),
            ...(filters?.labels
              ? { labels: JSON.stringify(filters.labels) }
              : {}),
            ...(filters?.customFields
              ? { customFields: JSON.stringify(filters.customFields) }
              : {}),
          },
        },
        { init: { signal } },
      );
      if (!response.ok)
        throw new HttpError(response.status, "Failed to fetch tasks");
      return response.json();
    },
    signal,
    onProgress,
  );
}
export default getTasks;
