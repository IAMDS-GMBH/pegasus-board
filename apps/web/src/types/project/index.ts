import type { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import type Task from "@/types/task";

export type Project = Extract<
  InferResponseType<(typeof client)["project"][":id"]["$get"], 200>,
  { id: string }
>;

type TasksApiResponse = InferResponseType<
  (typeof client)["task"]["tasks"][":projectId"]["$get"],
  200
>;

type ProjectWithTasksRaw = TasksApiResponse["data"];

export type ProjectWithTasks = Omit<
  ProjectWithTasksRaw,
  "archivedTasks" | "backgroundVersion" | "columns" | "plannedTasks"
> & {
  // Older cache fixtures and persisted query data predate board backgrounds.
  backgroundVersion?: string | null;
  archivedTasks: Task[];
  columns: Array<
    Omit<
      ProjectWithTasksRaw["columns"][number],
      "tasks" | "phase" | "isLocked"
    > & {
      // Pegasus fork (PEGA-170): persisted query data and fixtures predate
      // column phases and locks; missing means no phase, unlocked.
      phase?: string | null;
      isLocked?: boolean;
      tasks: Task[];
    }
  >;
  plannedTasks: Task[];
};
