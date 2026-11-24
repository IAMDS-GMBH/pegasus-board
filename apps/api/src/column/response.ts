import { responseTimestamp, z } from "../openapi";

export const columnSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    name: z.string(),
    slug: z.string().openapi({
      description:
        "Stable identifier derived from the name; tasks store this as their status.",
    }),
    position: z.number().openapi({
      description:
        "Board order, ascending. Columns are always returned sorted by it.",
    }),
    icon: z.string().nullable(),
    color: z.string().nullable(),
    isFinal: z.boolean().openapi({
      description:
        "Marks the column as a done state, which stops overdue reminders for tasks in it.",
    }),
    phase: z.string().nullable().openapi({
      description:
        "Phase the board shows the column under; null means no phase.",
    }),
    isLocked: z.boolean().openapi({
      description:
        "Technical column: members may not move cards into or out of it (403 COLUMN_LOCKED); owners, instance admins and the Hub's system account may.",
    }),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("Column");

export const columnListSchema = z.array(columnSchema);
