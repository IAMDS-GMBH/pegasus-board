import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

// Pegasus fork (PEGA-66): the overdue cards of the caller's Sichtbereich.
export type OverdueTasks = InferResponseType<
  (typeof client)["task"]["overdue"]["$get"],
  200
>;

export type OverdueTask = OverdueTasks["tasks"][number];

async function getOverdueTasks(workspaceId: string, countOnly = false) {
  const response = await client.task.overdue.$get({
    query: { workspaceId, countOnly: countOnly ? "true" : "false" },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getOverdueTasks;
