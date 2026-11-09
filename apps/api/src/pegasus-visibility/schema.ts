import { responseTimestamp, z } from "../openapi";

export const VISIBILITY_MODES = ["all", "units", "assigned"] as const;

const MAX_ENTRIES = 10_000;

const unitId = z.string().trim().min(1).max(200);

const userScope = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email().max(320)).openapi({
      format: "email",
      description:
        "Login email of the board user. Stored lower-case and matched to the account at query time, so the scope also applies to users who register later.",
    }),
    mode: z.enum(VISIBILITY_MODES).openapi({
      description:
        "`all` sees every task, `units` only tasks whose unit is listed, `assigned` only tasks assigned to the user.",
    }),
    unitIds: z.array(unitId).max(MAX_ENTRIES).openapi({
      description:
        "Every unit the user sees, already including the units below; must be empty unless `mode` is `units`.",
    }),
    permissions: z.array(z.string().trim().min(1).max(100)).max(200).openapi({
      description:
        "The user's effective rights in this workspace, as computed by the Hub (`LEAD_READ`, `LEAD_EDIT`, `LEAD_MOVE_STAGE`, `LEAD_CREATE`, `LEAD_ASSIGN_PROCESSOR`, `LEAD_DELETE`, `LEAD_EXPORT`, `REPORTING_VIEW`, ...). A right that is missing is denied. Unknown keys are stored, not rejected. Required: a snapshot without it is refused so an older Hub cannot switch a workspace to Hub rights.",
    }),
  })
  .refine((user) => user.mode === "units" || user.unitIds.length === 0, {
    message: "unitIds must be empty unless mode is units",
    path: ["unitIds"],
  });

export const workspaceIdParam = z.object({ workspaceId: z.string().min(1) });

export const taskIdParam = z.object({ taskId: z.string().min(1) });

export const replaceUserScopesBody = z.object({
  users: z
    .array(userScope)
    .max(MAX_ENTRIES)
    .refine(
      (users) => new Set(users.map((user) => user.email)).size === users.length,
      "Each email may appear only once",
    ),
});

export const setTaskUnitBody = z.object({
  unitId: unitId.nullable().openapi({
    description: "The unit of the task's lead; null removes it.",
  }),
});

export const setTaskUnitsBody = z.object({
  tasks: z
    .array(z.object({ taskId: z.string().min(1), unitId }))
    .max(MAX_ENTRIES)
    .refine(
      (tasks) =>
        new Set(tasks.map((task) => task.taskId)).size === tasks.length,
      "Each task may appear only once",
    ),
});

export const replaceUserScopesResponse = z.object({
  users: z.number().int().openapi({ description: "Number of stored users" }),
});

export const userScopesResponse = z.object({
  users: z.array(
    z.object({
      email: z.string(),
      mode: z.enum(VISIBILITY_MODES),
      unitIds: z.array(z.string()),
      permissions: z.array(z.string()),
      updatedAt: responseTimestamp,
    }),
  ),
});

export const taskUnitResponse = z.object({
  taskId: z.string(),
  unitId: z.string().nullable(),
});

export const setTaskUnitsResponse = z.object({
  tasks: z.number().int().openapi({ description: "Number of stored tasks" }),
});

export type UserScopeInput = z.infer<typeof userScope>;
