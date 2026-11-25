import { responseTimestamp, z } from "../openapi";

// Pegasus fork (PEGA-66): request and response of `GET /task/overdue`.

export const overdueTasksQuery = z.object({
  workspaceId: z.string().min(1),
  countOnly: z.enum(["true", "false"]).optional().openapi({
    description:
      "Return only the total, with an empty tasks array, without loading task rows.",
  }),
});

export const overdueTasksSchema = z
  .object({
    tasks: z.array(
      z
        .object({
          id: z.string(),
          projectId: z.string(),
          number: z.number().nullable(),
          title: z.string(),
          status: z.string().openapi({
            description: "The slug of the column the task sits in.",
          }),
          statusName: z.string().nullable().openapi({
            description:
              "The column's display name. Null for tasks outside a column, such as planned ones.",
          }),
          dueDate: responseTimestamp,
          assigneeId: z.string().nullable(),
          assigneeName: z.string().nullable(),
          projectName: z.string(),
          projectSlug: z.string(),
        })
        .openapi("OverdueTask"),
    ),
    total: z.number().openapi({
      description:
        "All overdue tasks the caller may see, including any beyond the first 100 returned.",
    }),
  })
  .openapi("OverdueTasks");
