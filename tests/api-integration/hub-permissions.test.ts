import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";
import { readErrorBody } from "./helpers/error-body";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import {
  type App,
  asUser,
  createHubScopeFixture,
  type HubScopeFixture,
  LEAD_RIGHTS,
} from "./helpers/hub-scope-fixture";

// Pegasus fork (PEGA-142): once the Hub has pushed a snapshot to a workspace,
// every member except owners, instance admins and the Hub's system account
// sees and does only what the Hub granted. Tree and unit sets:
// helpers/hub-scope-fixture.ts.

// Background notifications would race the next test's TRUNCATE.
vi.mock(
  "../../apps/api/src/notification/controllers/create-notification",
  () => ({ default: vi.fn(async () => null) }),
);

async function boardNames(f: HubScopeFixture, app: App) {
  const response = await app.request(`/api/task/tasks/${f.project.id}`);
  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    data: { columns: Array<{ tasks: Array<{ id: string }> }> };
  };
  return f.namesOf(
    body.data.columns.flatMap((column) => column.tasks.map((t) => t.id)),
  );
}

function putTitle(app: App, taskId: string, title: string) {
  return app.request(`/api/task/title/${taskId}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

function send(app: App, method: string, path: string, body?: unknown) {
  return app.request(`/api${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// Everything a row of the table may act on, all inside the BD leader's units.
async function seedExtras(f: HubScopeFixture) {
  const other = await createProjectFixture({
    workspaceId: f.workspace.id,
    slug: "other",
  });
  const [field] = await db
    .insert(schema.customFieldDefinitionTable)
    .values({ projectId: f.project.id, name: "Ort", type: "text" })
    .returning();
  const [freeLabel] = await db
    .insert(schema.labelTable)
    .values({ name: "Paket 1", color: "orange", workspaceId: f.workspace.id })
    .returning();
  const [taskLabel] = await db
    .insert(schema.labelTable)
    .values({
      name: "Paket 2",
      color: "orange",
      workspaceId: f.workspace.id,
      taskId: f.tasks.L1.id,
    })
    .returning();
  const [comment] = await db
    .insert(schema.activityTable)
    .values({
      taskId: f.tasks.L1.id,
      userId: f.users.fkBD.id,
      type: "comment",
      content: "Rückruf",
    })
    .returning();
  return { other, field, freeLabel, taskLabel, comment };
}

type Extras = Awaited<ReturnType<typeof seedExtras>>;
type Action = (f: HubScopeFixture, app: App, x: Extras) => Promise<Response>;

const L1 = (f: HubScopeFixture) => f.tasks.L1.id;
const bulk =
  (operation: string, value?: string | null): Action =>
  (f, app) =>
    send(app, "PATCH", "/task/bulk", { taskIds: [L1(f)], operation, value });

// Kaneo action → the Hub right it needs (SPEC Rollen & Rechte, PEGA-142).
const ACTIONS: Array<[string, string, Action]> = [
  [
    "exportTasks",
    "LEAD_EXPORT",
    (f, app) => app.request(`/api/task/export/${f.project.id}`),
  ],
  [
    "createTask",
    "LEAD_CREATE",
    (f, app) =>
      send(app, "POST", `/task/${f.project.id}`, {
        title: "Neu",
        description: "",
        priority: "medium",
        status: "to-do",
      }),
  ],
  [
    "duplicateTask",
    "LEAD_CREATE",
    (f, app) => send(app, "POST", `/task/duplicate/${L1(f)}`, {}),
  ],
  [
    "importTasks",
    "LEAD_CREATE",
    (f, app) =>
      send(app, "POST", `/task/import/${f.project.id}`, {
        tasks: [{ title: "Neu", status: "to-do" }],
      }),
  ],
  [
    "updateTask",
    "LEAD_EDIT",
    (f, app) =>
      send(app, "PUT", `/task/${L1(f)}`, {
        title: "Neu",
        priority: "high",
        status: "to-do",
        projectId: f.project.id,
        position: 1,
      }),
  ],
  [
    "updateTaskTitle",
    "LEAD_EDIT",
    (f, app) => send(app, "PUT", `/task/title/${L1(f)}`, { title: "Neu" }),
  ],
  [
    "updateTaskPriority",
    "LEAD_EDIT",
    (f, app) =>
      send(app, "PUT", `/task/priority/${L1(f)}`, { priority: "high" }),
  ],
  [
    "updateTaskDueDate",
    "LEAD_EDIT",
    (f, app) =>
      send(app, "PUT", `/task/due-date/${L1(f)}`, {
        dueDate: "2026-12-01T00:00:00.000Z",
      }),
  ],
  [
    "updateTaskDescription",
    "LEAD_EDIT",
    (f, app) =>
      send(app, "PUT", `/task/description/${L1(f)}`, { description: "Neu" }),
  ],
  [
    "setCustomFieldValue",
    "LEAD_EDIT",
    (f, app, x) =>
      send(app, "PUT", "/custom-field/value", {
        taskId: L1(f),
        fieldId: x.field.id,
        value: "Augsburg",
      }),
  ],
  [
    "attachLabelToTask",
    "LEAD_EDIT",
    (f, app, x) =>
      send(app, "PUT", `/label/${x.freeLabel.id}/task`, { taskId: L1(f) }),
  ],
  [
    "detachLabelFromTask",
    "LEAD_EDIT",
    (_f, app, x) => send(app, "DELETE", `/label/${x.taskLabel.id}/task`),
  ],
  [
    "createTaskComment",
    "LEAD_EDIT",
    (f, app) => send(app, "POST", `/comment/${L1(f)}`, { content: "Neu" }),
  ],
  [
    "updateTaskComment",
    "LEAD_EDIT",
    (_f, app, x) =>
      send(app, "PUT", `/comment/${x.comment.id}`, { content: "Neu" }),
  ],
  [
    "deleteTaskComment",
    "LEAD_EDIT",
    (_f, app, x) => send(app, "DELETE", `/comment/${x.comment.id}`),
  ],
  [
    "createComment (activity)",
    "LEAD_EDIT",
    (f, app) =>
      send(app, "POST", "/activity/comment", { taskId: L1(f), comment: "Neu" }),
  ],
  [
    "updateComment (activity)",
    "LEAD_EDIT",
    (_f, app, x) =>
      send(app, "PUT", "/activity/comment", {
        activityId: x.comment.id,
        comment: "Neu",
      }),
  ],
  [
    "deleteComment (activity)",
    "LEAD_EDIT",
    (_f, app, x) =>
      send(app, "DELETE", "/activity/comment", { activityId: x.comment.id }),
  ],
  [
    "createTaskRelation",
    "LEAD_EDIT",
    (f, app) =>
      send(app, "POST", "/task-relation", {
        sourceTaskId: L1(f),
        targetTaskId: f.tasks.L2.id,
        relationType: "related",
      }),
  ],
  [
    "createTimeEntry",
    "LEAD_EDIT",
    (f, app) =>
      send(app, "POST", "/time-entry", {
        taskId: L1(f),
        startTime: "2026-11-05T08:00:00.000Z",
        endTime: "2026-11-05T09:00:00.000Z",
      }),
  ],
  [
    "createExternalLink",
    "LEAD_EDIT",
    (f, app) =>
      send(app, "POST", `/external-link/task/${L1(f)}`, {
        url: "https://example.com/akte",
      }),
  ],
  [
    "updateTaskStatus",
    "LEAD_MOVE_STAGE",
    (f, app) =>
      send(app, "PUT", `/task/status/${L1(f)}`, { status: "in-progress" }),
  ],
  [
    "moveTask",
    "LEAD_MOVE_STAGE",
    (f, app, x) =>
      send(app, "PUT", `/task/move/${L1(f)}`, {
        destinationProjectId: x.other.project.id,
      }),
  ],
  [
    "reorderTasks across columns",
    "LEAD_MOVE_STAGE",
    (f, app) =>
      send(app, "POST", "/task/reorder", {
        projectId: f.project.id,
        tasks: [{ id: L1(f), position: 1, status: "in-progress" }],
      }),
  ],
  [
    "reorderTasks within a column",
    "LEAD_EDIT",
    (f, app) =>
      send(app, "POST", "/task/reorder", {
        projectId: f.project.id,
        tasks: [{ id: L1(f), position: 9, status: "to-do" }],
      }),
  ],
  [
    "updateTaskAssignee",
    "LEAD_ASSIGN_PROCESSOR",
    (f, app) =>
      send(app, "PUT", `/task/assignee/${L1(f)}`, { userId: f.users.fkBD.id }),
  ],
  [
    "deleteTask",
    "LEAD_DELETE",
    (f, app) => send(app, "DELETE", `/task/${L1(f)}`),
  ],
  ["bulkUpdateTasks delete", "LEAD_DELETE", bulk("delete")],
  [
    "bulkUpdateTasks updateAssignee",
    "LEAD_ASSIGN_PROCESSOR",
    (f, app) => bulk("updateAssignee", f.users.fkBD.id)(f, app, {} as Extras),
  ],
  [
    "bulkUpdateTasks updateStatus",
    "LEAD_MOVE_STAGE",
    bulk("updateStatus", "in-progress"),
  ],
  [
    "bulkUpdateTasks updatePriority",
    "LEAD_EDIT",
    bulk("updatePriority", "high"),
  ],
  [
    "bulkUpdateTasks addLabel",
    "LEAD_EDIT",
    (f, app, x) => bulk("addLabel", x.freeLabel.id)(f, app, x),
  ],
];

const FK_BD = "fk-bd@wwk.test";

describe("API integration: rights pushed by the Hub", () => {
  beforeEach(() => resetTestDatabase());

  describe("which members the Hub governs", () => {
    it("leaves a workspace the Hub never pushed to as in Kaneo", async () => {
      const member = await createWorkspaceMember({ role: "member" });
      const { project, columns } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      const [task] = await db
        .insert(schema.taskTable)
        .values({
          projectId: project.id,
          columnId: columns.todo.id,
          title: "Lead",
          status: "to-do",
          priority: "medium",
          number: 1,
          position: 1,
        })
        .returning();
      const app = asUser(member.user);

      expect((await putTitle(app, task.id, "Lead 2")).status).toBe(200);
      expect((await app.request(`/api/task/export/${project.id}`)).status).toBe(
        200,
      );
    });

    it("hides every task from a member the snapshot leaves out, whatever their role", async () => {
      const f = await createHubScopeFixture();

      expect(await boardNames(f, asUser(f.users.innendienst))).toEqual([]);
    });

    it("lets such a member change nothing", async () => {
      const f = await createHubScopeFixture();
      await f.pushScopes([
        ...f.defaultScopes,
        {
          email: "innendienst@wwk.test",
          mode: "all",
          unitIds: [],
          permissions: ["LEAD_READ"],
        },
      ]);
      const response = await putTitle(
        asUser(f.users.innendienst),
        f.tasks.L1.id,
        "Neu",
      );

      expect(response.status).toBe(403);
      expect(await readErrorBody(response)).toMatchObject({
        code: "MISSING_PERMISSION",
        missingPermissions: ["LEAD_EDIT"],
      });
    });
  });
  describe("lead actions", () => {
    it.each(ACTIONS)("denies %s without %s", async (_name, key, action) => {
      const f = await createHubScopeFixture();
      const x = await seedExtras(f);
      await f.pushPermissions(
        FK_BD,
        LEAD_RIGHTS.filter((right) => right !== key),
      );

      const response = await action(f, asUser(f.users.fkBD), x);

      expect(response.status).toBe(403);
      expect(await readErrorBody(response)).toMatchObject({
        code: "MISSING_PERMISSION",
        missingPermissions: [key],
      });
    });

    // The fixture's Kaneo role only holds task read and update, so a pass
    // also shows the Hub right replaces the role check instead of adding one.
    it.each(ACTIONS)("allows %s with only %s", async (_name, key, action) => {
      const f = await createHubScopeFixture();
      const x = await seedExtras(f);
      await f.pushPermissions(FK_BD, ["LEAD_READ", key]);

      const response = await action(f, asUser(f.users.fkBD), x);

      expect(response.status, await response.clone().text()).toBeLessThan(300);
    });
  });
  describe("a full update", () => {
    const update = (f: HubScopeFixture, app: App, change: object) =>
      send(app, "PUT", `/task/${L1(f)}`, {
        title: "Lead L1",
        priority: "medium",
        status: "to-do",
        projectId: f.project.id,
        position: 1,
        ...change,
      });

    it.each([
      ["a status change", { status: "in-progress" }, "LEAD_MOVE_STAGE"],
      [
        "an assignee change",
        { userId: "user-fk-fd@wwk.test" },
        "LEAD_ASSIGN_PROCESSOR",
      ],
    ] as const)("needs %s's own right", async (_name, change, key) => {
      const f = await createHubScopeFixture();
      await f.pushPermissions(FK_BD, ["LEAD_READ", "LEAD_EDIT"]);
      const app = asUser(f.users.fkBD);

      const denied = await update(f, app, change);
      expect(denied.status).toBe(403);
      expect(await readErrorBody(denied)).toMatchObject({
        missingPermissions: [key],
      });

      await f.pushPermissions(FK_BD, ["LEAD_READ", "LEAD_EDIT", key]);
      expect((await update(f, asUser(f.users.fkBD), change)).status).toBe(200);
    });
  });
  describe("duplicating a subtask", () => {
    it.each([
      [["LEAD_READ", "LEAD_CREATE"], 403],
      [["LEAD_READ", "LEAD_CREATE", "LEAD_EDIT"], 200],
    ])(
      "with %j answers %i, since it links the copy to the parent",
      async (rights, status) => {
        const f = await createHubScopeFixture();
        await db.insert(schema.taskRelationTable).values({
          sourceTaskId: f.tasks.L1.id,
          targetTaskId: f.tasks.L2.id,
          relationType: "subtask",
        });
        await f.pushPermissions(FK_BD, rights);

        const response = await send(
          asUser(f.users.fkBD),
          "POST",
          `/task/duplicate/${f.tasks.L2.id}`,
          {},
        );

        expect(response.status).toBe(status);
      },
    );
  });

  describe("reporting", () => {
    async function statistics(f: HubScopeFixture) {
      const response = await asUser(f.users.fkBD).request(
        `/api/project?workspaceId=${f.workspace.id}`,
      );
      expect(response.status).toBe(200);
      const [project] = (await response.json()) as Array<{
        statistics?: { totalTasks: number; completionPercentage: number };
      }>;
      return project?.statistics;
    }

    it("leaves the project statistics out without REPORTING_VIEW", async () => {
      const f = await createHubScopeFixture();
      await f.pushPermissions(
        FK_BD,
        LEAD_RIGHTS.filter((right) => right !== "REPORTING_VIEW"),
      );

      expect(await statistics(f)).toBeUndefined();
    });

    it("counts the visible tasks with REPORTING_VIEW", async () => {
      const f = await createHubScopeFixture();
      await f.pushPermissions(FK_BD, ["LEAD_READ", "REPORTING_VIEW"]);

      expect(await statistics(f)).toMatchObject({ totalTasks: 2 });
    });
  });
  describe("who is exempt", () => {
    afterEach(() => vi.unstubAllEnvs());

    async function addHubAccount(f: HubScopeFixture, email: string) {
      const [user] = await db
        .insert(schema.userTable)
        .values({
          id: `user-${email}`,
          email,
          emailVerified: true,
          name: "Hub",
        })
        .returning();
      await db.insert(schema.workspaceUserTable).values({
        workspaceId: f.workspace.id,
        userId: user.id,
        role: "admin",
        joinedAt: new Date(),
      });
      return user;
    }

    async function seesAndDeletes(f: HubScopeFixture, app: App) {
      expect(await boardNames(f, app)).toEqual([
        "L1",
        "L2",
        "L3",
        "L4",
        "L5",
        "L6",
        "M1",
        "N0",
      ]);
      expect((await send(app, "DELETE", `/task/${L1(f)}`)).status).toBe(200);
    }

    it("does not restrict the owner, who is not in the snapshot", async () => {
      const f = await createHubScopeFixture();

      await seesAndDeletes(f, asUser(f.owner));
    });

    it("does not restrict an instance admin", async () => {
      const f = await createHubScopeFixture();
      await db
        .update(schema.userTable)
        .set({ role: "admin" })
        .where(eq(schema.userTable.id, f.users.noRow.id));

      await seesAndDeletes(f, asUser(f.users.noRow));
    });

    it("does not restrict the Hub's system account named in PEGASUS_HUB_USER_ID", async () => {
      const f = await createHubScopeFixture();
      const hub = await addHubAccount(f, "pegasus-hub@wwk.test");
      vi.stubEnv("PEGASUS_HUB_USER_ID", ` ${hub.id} `);

      await seesAndDeletes(f, asUser(hub));
    });

    it("restricts an admin account the variable does not name", async () => {
      const f = await createHubScopeFixture();
      const hub = await addHubAccount(f, "pegasus-hub@wwk.test");
      const other = await addHubAccount(f, "key-account-admin@wwk.test");
      vi.stubEnv("PEGASUS_HUB_USER_ID", hub.id);

      expect(await boardNames(f, asUser(other))).toEqual([]);
    });

    // The id, not the address: whoever signs up with or switches to the
    // system account's email gains nothing.
    it("restricts an account that only shares the system account's email", async () => {
      const f = await createHubScopeFixture();
      const lookalike = await addHubAccount(f, "pegasus-hub@wwk.test");
      vi.stubEnv("PEGASUS_HUB_USER_ID", "user-the-real-hub");

      expect(await boardNames(f, asUser(lookalike))).toEqual([]);
    });
  });

  describe("Kaneo roles of governed members", () => {
    it("cannot widen what the Hub granted, not even the admin role", async () => {
      const f = await createHubScopeFixture();
      await db
        .update(schema.workspaceUserTable)
        .set({ role: "admin" })
        .where(eq(schema.workspaceUserTable.userId, f.users.fkBD.id));
      await f.pushPermissions(FK_BD, ["LEAD_READ", "LEAD_EDIT"]);
      const app = asUser(f.users.fkBD);

      const response = await send(app, "DELETE", `/task/${L1(f)}`);
      expect(response.status).toBe(403);
      expect(await readErrorBody(response)).toMatchObject({
        missingPermissions: ["LEAD_DELETE"],
      });
    });

    it("cannot block what the Hub granted, not even the viewer role", async () => {
      const f = await createHubScopeFixture();
      await db
        .update(schema.workspaceUserTable)
        .set({ role: "viewer" })
        .where(eq(schema.workspaceUserTable.userId, f.users.fkBD.id));
      await f.pushPermissions(FK_BD, ["LEAD_READ", "LEAD_EDIT"]);

      expect((await putTitle(asUser(f.users.fkBD), L1(f), "Neu")).status).toBe(
        200,
      );
    });

    it("still narrows a governed member by the API key's scope", async () => {
      const f = await createHubScopeFixture();
      const key = `hub-permissions-${f.users.fkBD.id}`.padEnd(64, "x");
      await db.insert(schema.apikeyTable).values({
        referenceId: f.users.fkBD.id,
        userId: f.users.fkBD.id,
        key: createHash("sha256").update(key).digest("base64url"),
        permissions: JSON.stringify({ task: ["read"] }),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await createApp().app.request(
        `/api/task/title/${L1(f)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json", "x-api-key": key },
          body: JSON.stringify({ title: "Neu" }),
        },
      );

      expect(response.status).toBe(403);
      expect(await readErrorBody(response)).toMatchObject({
        code: "API_KEY_SCOPE",
      });
    });
  });
  describe("capabilities for the web app", () => {
    async function capabilities(app: App, workspaceId: string) {
      const response = await app.request(
        `/api/workspace/${workspaceId}/capabilities`,
      );
      expect(response.status).toBe(200);
      return (await response.json()) as Record<string, boolean>;
    }

    it("reports the Hub's rights in place of the lead capabilities", async () => {
      const f = await createHubScopeFixture();
      await f.pushPermissions(FK_BD, ["LEAD_READ", "LEAD_EDIT", "LEAD_DELETE"]);

      expect(
        await capabilities(asUser(f.users.fkBD), f.workspace.id),
      ).toMatchObject({
        createTasks: false,
        updateTasks: true,
        labelTasks: true,
        moveTasks: false,
        assignTasks: false,
        deleteTasks: true,
        exportTasks: false,
        viewReports: false,
        returnTasks: false,
        // Board-own things stay with the Kaneo role.
        manageSettings: false,
      });
    });

    it("keeps Kaneo's capabilities in a workspace the Hub does not manage", async () => {
      const member = await createWorkspaceMember({ role: "member" });

      expect(
        await capabilities(asUser(member.user), member.workspace.id),
      ).toMatchObject({
        createTasks: true,
        updateTasks: true,
        moveTasks: true,
        deleteTasks: false,
        exportTasks: true,
        viewReports: true,
        returnTasks: true,
      });
    });
  });
});
