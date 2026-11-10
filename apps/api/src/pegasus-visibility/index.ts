import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { denyHubGoverned } from "./deny-hub-governed";
import getUserScopes from "./controllers/get-user-scopes";
import replaceUserScopes from "./controllers/replace-user-scopes";
import setTaskUnit from "./controllers/set-task-unit";
import setTaskUnits from "./controllers/set-task-units";
import {
  replaceUserScopesBody,
  replaceUserScopesResponse,
  setTaskUnitBody,
  setTaskUnitsBody,
  setTaskUnitsResponse,
  taskIdParam,
  taskUnitResponse,
  userScopesResponse,
  workspaceIdParam,
} from "./schema";

// Pegasus fork (PEGA-141, PEGA-142): the Pegasus Hub owns the unit hierarchy
// and the rights, and pushes what each user may see and do. From the first
// user snapshot on, every member except owners, instance admins and the Hub's
// system account is bound by it (`task-scope/`, `utils/require-hub-permission`),
// and only those three may use these routes (`deny-hub-governed`).
// A listed user with a verified email becomes a member without an invitation
// (PEGA-143, `add-hub-members`).
// These are the only routes that write the pegasus_* tables. Paths and
// operation ids are the contract with the Hub: do not rename them.

const TAGS = ["Pegasus visibility"];
const manageSettings = [
  requireWorkspacePermission({ workspace: ["manage_settings"] }),
  denyHubGoverned,
] as const;

const replaceUserScopesRoute = createRoute({
  method: "put",
  operationId: "replacePegasusUserScopes",
  path: "/workspace/{workspaceId}/users",
  tags: TAGS,
  summary: "Replace the visibility of all users",
  description:
    "Replaces every user scope and right of the workspace with this snapshot in one transaction. The first snapshot hands the workspace to the Hub: from then on every member except owners, instance admins and the Hub's system account (`PEGASUS_HUB_USER_EMAIL`) sees and does only what the snapshot grants. A user who is not listed sees and does nothing. Listed users whose account has a verified email and who are not yet members join the workspace with its read-only role `pegasus` (nobody joins while the workspace has no such role); members are never removed or changed here.",
  middleware: [workspaceAccess.fromParam(), ...manageSettings] as const,
  request: {
    params: workspaceIdParam,
    body: {
      content: { "application/json": { schema: replaceUserScopesBody } },
    },
  },
  responses: {
    200: jsonResponse("Snapshot stored", replaceUserScopesResponse),
    400: errorResponse(
      "Invalid body, duplicate email, or units on a mode other than units",
    ),
    403: errorResponse(
      "Missing workspace:manage_settings permission, or a member the Hub governs",
    ),
    404: errorResponse("Workspace not found"),
  },
});

const getUserScopesRoute = createRoute({
  method: "get",
  operationId: "getPegasusUserScopes",
  path: "/workspace/{workspaceId}/users",
  tags: TAGS,
  summary: "Get the visibility of all users",
  description: "Returns the stored snapshot, sorted by email.",
  middleware: [workspaceAccess.fromParam(), ...manageSettings] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("Stored snapshot", userScopesResponse),
    403: errorResponse(
      "Missing workspace:manage_settings permission, or a member the Hub governs",
    ),
    404: errorResponse("Workspace not found"),
  },
});

const setTaskUnitRoute = createRoute({
  method: "put",
  operationId: "setPegasusTaskUnit",
  path: "/task/{taskId}/unit",
  tags: TAGS,
  summary: "Set the unit of a task",
  description:
    "Sets the unit of the task's lead, or removes it with null. A task without a unit is visible only to users with mode `all`.",
  middleware: [
    workspaceAccess.fromTaskId("taskId"),
    ...manageSettings,
  ] as const,
  request: {
    params: taskIdParam,
    body: { content: { "application/json": { schema: setTaskUnitBody } } },
  },
  responses: {
    200: jsonResponse("Unit stored", taskUnitResponse),
    400: errorResponse("Invalid body"),
    403: errorResponse(
      "Missing workspace:manage_settings permission, or a member the Hub governs",
    ),
    404: errorResponse("Task not found"),
  },
});

const setTaskUnitsRoute = createRoute({
  method: "put",
  operationId: "setPegasusTaskUnits",
  path: "/workspace/{workspaceId}/tasks",
  tags: TAGS,
  summary: "Set the units of many tasks",
  description:
    "Upserts the unit of every listed task; tasks not listed keep theirs. If any task is unknown or outside the workspace, nothing is written and the response names them.",
  middleware: [workspaceAccess.fromParam(), ...manageSettings] as const,
  request: {
    params: workspaceIdParam,
    body: { content: { "application/json": { schema: setTaskUnitsBody } } },
  },
  responses: {
    200: jsonResponse("Units stored", setTaskUnitsResponse),
    400: errorResponse(
      "Invalid body, or tasks that are unknown or outside the workspace",
    ),
    403: errorResponse(
      "Missing workspace:manage_settings permission, or a member the Hub governs",
    ),
    404: errorResponse("Workspace not found"),
  },
});

const pegasusVisibility = apiRouter()
  .openapi(replaceUserScopesRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    const { users } = c.req.valid("json");
    return c.json(await replaceUserScopes(workspaceId, users), 200);
  })
  .openapi(getUserScopesRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    return c.json(await getUserScopes(workspaceId), 200);
  })
  .openapi(setTaskUnitRoute, async (c) => {
    const { taskId } = c.req.valid("param");
    const { unitId } = c.req.valid("json");
    return c.json(await setTaskUnit(taskId, unitId), 200);
  })
  .openapi(setTaskUnitsRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    const { tasks } = c.req.valid("json");
    return c.json(await setTaskUnits(workspaceId, tasks), 200);
  });

export default pegasusVisibility;
