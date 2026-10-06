import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import globalSearch from "../../apps/api/src/search/controllers/global-search";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

// Assignment and comment notifications run in the background and would race
// the next test's TRUNCATE. Notification scoping is documented as an open
// surface for this permission and is not under test here.
vi.mock(
  "../../apps/api/src/notification/controllers/create-notification",
  () => ({
    default: vi.fn(async () => null),
  }),
);

const ROLE = "fuehrungskraft";

// The restricted role as the pilot will configure it: read and edit, but no
// create, delete, assign or settings, plus the `assignedOnly` restriction.
const RESTRICTED_PERMISSION = {
  task: ["read", "update"],
  project: ["read"],
  workspace: ["read"],
};

type App = ReturnType<typeof createApp>["app"];

async function createRoleRow(
  workspaceId: string,
  role: string,
  permission: Record<string, string[]>,
  assignedOnly = false,
) {
  await db.insert(schema.workspaceRoleTable).values({
    workspaceId,
    role,
    permission: JSON.stringify(permission),
    assignedOnly,
  });
}

async function addMember(workspaceId: string, role: string, name: string) {
  const userId = `user-${randomUUID()}`;
  const [user] = await db
    .insert(schema.userTable)
    .values({
      id: userId,
      email: `${userId}@example.com`,
      emailVerified: true,
      name,
    })
    .returning();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: user.id,
    role,
    joinedAt: new Date(),
  });
  return user;
}

async function seedTask(input: {
  projectId: string;
  columnId: string;
  number: number;
  title: string;
  assigneeId?: string;
  description?: string;
}) {
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: input.projectId,
      title: input.title,
      description: input.description ?? "",
      priority: "medium",
      status: "to-do",
      columnId: input.columnId,
      number: input.number,
      position: input.number,
      ...(input.assigneeId ? { userId: input.assigneeId } : {}),
    })
    .returning();
  return task;
}

async function seedComment(taskId: string, userId: string, content: string) {
  const [row] = await db
    .insert(schema.activityTable)
    .values({ taskId, userId, type: "comment", content })
    .returning();
  return row;
}

async function seedTimeEntry(taskId: string, userId: string) {
  const [row] = await db
    .insert(schema.timeEntryTable)
    .values({ taskId, userId, startTime: new Date() })
    .returning();
  return row;
}

async function seedLabel(workspaceId: string, taskId: string) {
  const [row] = await db
    .insert(schema.labelTable)
    .values({ workspaceId, taskId, name: "Kampagne A", color: "#009036" })
    .returning();
  return row;
}

async function seedCustomField(projectId: string, name = "Region") {
  const [row] = await db
    .insert(schema.customFieldDefinitionTable)
    .values({ projectId, name, type: "text", required: false, position: 0 })
    .returning();
  return row;
}

async function seedCustomFieldValue(
  taskId: string,
  fieldId: string,
  value: string,
) {
  await db
    .insert(schema.customFieldValueTable)
    .values({ taskId, fieldId, value });
}

async function fixture() {
  // `createWorkspaceMember` is the restricted user; a second member (plain
  // `member` role) owns the "foreign" task.
  const restricted = await createWorkspaceMember({
    role: ROLE,
    userName: "Fuehrungskraft",
  });
  const workspace = restricted.workspace;
  await createRoleRow(workspace.id, ROLE, RESTRICTED_PERMISSION, true);
  const colleague = await addMember(workspace.id, "member", "Innendienst");
  const { project, columns } = await createProjectFixture({
    workspaceId: workspace.id,
    slug: "pool",
  });

  const mine = await seedTask({
    projectId: project.id,
    columnId: columns.todo.id,
    number: 1,
    title: "Bewerber Mein",
    assigneeId: restricted.user.id,
  });
  const theirs = await seedTask({
    projectId: project.id,
    columnId: columns.todo.id,
    number: 2,
    title: "Bewerber Fremd",
    assigneeId: colleague.id,
  });
  const unassigned = await seedTask({
    projectId: project.id,
    columnId: columns.todo.id,
    number: 3,
    title: "Bewerber Pool",
  });

  return {
    restricted,
    colleague,
    workspace,
    project,
    columns,
    mine,
    theirs,
    unassigned,
  };
}

function asUser(user: typeof schema.userTable.$inferSelect): App {
  mockAuthenticatedSession(user);
  return createApp().app;
}

async function listTasks(app: App, projectId: string, query = "") {
  const response = await app.request(`/api/task/tasks/${projectId}${query}`);
  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    data: {
      columns: Array<{ tasks: Array<{ id: string }> }>;
      plannedTasks: Array<{ id: string }>;
      archivedTasks: Array<{ id: string }>;
    };
    pagination: { total: number; totalPages: number };
  };
  const ids = [
    ...body.data.columns.flatMap((column) =>
      column.tasks.map((task) => task.id),
    ),
    ...body.data.plannedTasks.map((task) => task.id),
    ...body.data.archivedTasks.map((task) => task.id),
  ];
  return { ids, pagination: body.pagination };
}

async function search(
  app: App,
  workspaceId: string,
  q: string,
  type = "tasks",
) {
  const response = await app.request(
    `/api/search?q=${encodeURIComponent(q)}&type=${type}&workspaceId=${workspaceId}`,
  );
  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    results: Array<{
      id: string;
      type: string;
      title: string;
      content?: string;
    }>;
  };
  return body.results;
}

describe("API integration: task:view_assigned_only row filter", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe("board list", () => {
    it("returns only the restricted user's tasks and paginates after filtering", async () => {
      const f = await fixture();
      const app = asUser(f.restricted.user);

      const { ids, pagination } = await listTasks(app, f.project.id);

      expect(ids).toEqual([f.mine.id]);
      expect(pagination.total).toBe(1);
      expect(pagination.totalPages).toBe(1);
    });

    it("cannot be widened by the client-side assignee filter", async () => {
      const f = await fixture();
      const app = asUser(f.restricted.user);

      const { ids } = await listTasks(
        app,
        f.project.id,
        `?assigneeId=${f.colleague.id}`,
      );

      expect(ids).toEqual([]);
    });

    it("leaves members and custom roles without the restriction unaffected", async () => {
      const f = await fixture();
      await createRoleRow(f.workspace.id, "innendienst", {
        task: ["read", "update"],
        project: ["read"],
        workspace: ["read"],
      });
      const innendienst = await addMember(
        f.workspace.id,
        "innendienst",
        "Innendienst 2",
      );

      for (const user of [f.colleague, innendienst]) {
        const { ids } = await listTasks(asUser(user), f.project.id);
        expect(ids.sort()).toEqual(
          [f.mine.id, f.theirs.id, f.unassigned.id].sort(),
        );
      }
    });
  });

  describe("single task and the shared lookup", () => {
    it("hides foreign and unassigned tasks as 404 and serves the own task", async () => {
      const f = await fixture();
      const app = asUser(f.restricted.user);

      expect((await app.request(`/api/task/${f.mine.id}`)).status).toBe(200);

      for (const hidden of [f.theirs, f.unassigned]) {
        const response = await app.request(`/api/task/${hidden.id}`);
        expect(response.status).toBe(404);
        expect(await response.text()).toBe("Task not found");
      }
    });

    it("cannot be bypassed through the ?workspaceId fallback", async () => {
      const f = await fixture();
      const app = asUser(f.restricted.user);

      const response = await app.request(
        `/api/task/${f.theirs.id}?workspaceId=${f.workspace.id}`,
      );

      expect(response.status).toBe(404);
    });

    it("keeps the existing 400 for ids that do not exist", async () => {
      const f = await fixture();
      const app = asUser(f.restricted.user);

      const response = await app.request(`/api/task/${randomUUID()}`);

      expect(response.status).toBe(400);
    });

    it("covers activities, comments, time entries and labels of a hidden task", async () => {
      const f = await fixture();
      const theirComment = await seedComment(
        f.theirs.id,
        f.colleague.id,
        "Telefonat geführt",
      );
      const theirEntry = await seedTimeEntry(f.theirs.id, f.colleague.id);
      const theirLabel = await seedLabel(f.workspace.id, f.theirs.id);
      const myComment = await seedComment(
        f.mine.id,
        f.restricted.user.id,
        "Erstkontakt",
      );
      const myEntry = await seedTimeEntry(f.mine.id, f.restricted.user.id);
      const myLabel = await seedLabel(f.workspace.id, f.mine.id);
      const app = asUser(f.restricted.user);

      const hiddenRequests: Array<[string, RequestInit?]> = [
        [`/api/activity/${f.theirs.id}`],
        [`/api/comment/${f.theirs.id}`],
        [
          `/api/comment/${f.theirs.id}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ content: "Darf nicht landen" }),
          },
        ],
        [
          `/api/comment/${theirComment.id}?workspaceId=${f.workspace.id}`,
          {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ content: "Darf nicht landen" }),
          },
        ],
        [`/api/time-entry/task/${f.theirs.id}`],
        [`/api/time-entry/${theirEntry.id}`],
        [`/api/label/task/${f.theirs.id}`],
        [`/api/label/${theirLabel.id}`],
        [`/api/task/${f.theirs.id}/description?offset=0`],
      ];
      for (const [path, init] of hiddenRequests) {
        const response = await app.request(path, init);
        expect(response.status, path).toBe(404);
      }

      const visibleRequests: string[] = [
        `/api/activity/${f.mine.id}`,
        `/api/comment/${f.mine.id}`,
        `/api/time-entry/task/${f.mine.id}`,
        `/api/time-entry/${myEntry.id}`,
        `/api/label/task/${f.mine.id}`,
        `/api/label/${myLabel.id}`,
        `/api/task/${f.mine.id}/description?offset=0`,
      ];
      for (const path of visibleRequests) {
        const response = await app.request(path);
        expect(response.status, path).toBe(200);
      }

      const comments = (await (
        await app.request(`/api/comment/${f.mine.id}`)
      ).json()) as Array<{ id: string }>;
      expect(comments.map((comment) => comment.id)).toEqual([myComment.id]);

      const [foreignComment] = await db
        .select({ content: schema.activityTable.content })
        .from(schema.activityTable)
        .where(eq(schema.activityTable.id, theirComment.id));
      expect(foreignComment?.content).toBe("Telefonat geführt");
    });

    it("rejects a bulk update that mixes own and hidden tasks without touching either", async () => {
      const f = await fixture();
      const app = asUser(f.restricted.user);
      const bulk = (taskIds: string[]) =>
        app.request("/api/task/bulk", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            taskIds,
            operation: "updatePriority",
            value: "urgent",
          }),
        });

      const mixed = await bulk([f.mine.id, f.theirs.id]);
      expect(mixed.status).toBe(404);
      expect(await mixed.text()).toBe("No tasks found");

      const rows = await db
        .select({
          id: schema.taskTable.id,
          priority: schema.taskTable.priority,
        })
        .from(schema.taskTable);
      expect(rows.every((row) => row.priority === "medium")).toBe(true);

      const own = await bulk([f.mine.id]);
      expect(own.status).toBe(200);
    });
  });

  describe("export, search and description matches", () => {
    it("exports only the own tasks", async () => {
      const f = await fixture();
      const app = asUser(f.restricted.user);

      const response = await app.request(`/api/task/export/${f.project.id}`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        tasks: Array<{ title: string }>;
      };

      expect(body.tasks.map((task) => task.title)).toEqual(["Bewerber Mein"]);

      const colleagueExport = (await (
        await asUser(f.colleague).request(`/api/task/export/${f.project.id}`)
      ).json()) as { tasks: unknown[] };
      expect(colleagueExport.tasks).toHaveLength(3);
    });

    it("filters task, short-id and comment search results", async () => {
      const f = await fixture();
      await seedComment(f.theirs.id, f.colleague.id, "Rückruf vereinbart");
      await seedComment(f.mine.id, f.restricted.user.id, "Rückruf erledigt");
      const app = asUser(f.restricted.user);

      const tasks = await search(app, f.workspace.id, "Bewerber");
      expect(tasks.map((result) => result.id)).toEqual([f.mine.id]);

      expect(await search(app, f.workspace.id, "POOL-2")).toEqual([]);
      expect(
        (await search(app, f.workspace.id, "POOL-1")).map((r) => r.id),
      ).toEqual([f.mine.id]);

      const comments = await search(app, f.workspace.id, "Rückruf", "comments");
      expect(comments.map((result) => result.content)).toEqual([
        "Rückruf erledigt",
      ]);

      const colleagueTasks = await search(
        asUser(f.colleague),
        f.workspace.id,
        "Bewerber",
      );
      expect(colleagueTasks).toHaveLength(3);
    });

    it("scopes search per workspace when the user is restricted in only one", async () => {
      const f = await fixture();
      // Same user, second workspace, unrestricted role.
      const other = await createWorkspaceMember({ role: "member" });
      await db
        .update(schema.workspaceUserTable)
        .set({ userId: f.restricted.user.id })
        .where(eq(schema.workspaceUserTable.workspaceId, other.workspace.id));
      const otherProject = await createProjectFixture({
        workspaceId: other.workspace.id,
        slug: "other",
      });
      const otherTask = await seedTask({
        projectId: otherProject.project.id,
        columnId: otherProject.columns.todo.id,
        number: 1,
        title: "Bewerber Anderswo",
        assigneeId: other.user.id,
      });

      const result = await globalSearch({
        query: "Bewerber",
        userId: f.restricted.user.id,
        type: "tasks",
        assignedOnlyWorkspaceIds: [f.workspace.id],
      });

      expect(result.results.map((entry) => entry.id).sort()).toEqual(
        [f.mine.id, otherTask.id].sort(),
      );
    });

    it("returns only own ids from deferred description matches", async () => {
      const f = await fixture();
      const longText = `${"x".repeat(70 * 1024)} Gesprächsnotiz needle`;
      await db
        .update(schema.taskTable)
        .set({ description: longText })
        .where(eq(schema.taskTable.id, f.mine.id));
      await db
        .update(schema.taskTable)
        .set({ description: longText })
        .where(eq(schema.taskTable.id, f.theirs.id));
      const app = asUser(f.restricted.user);

      const response = await app.request(
        `/api/task/description-matches/${f.project.id}?query=needle`,
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as { ids: string[] };

      expect(body.ids).toEqual([f.mine.id]);
    });
  });

  describe("ticket-id links, workspace activity and integration sync", () => {
    it("resolves only the own task by ticket id", async () => {
      const f = await fixture();
      const app = asUser(f.restricted.user);

      const own = await app.request("/api/task/by-ticket-id/POOL-1");
      expect(own.status).toBe(200);
      expect(((await own.json()) as { id: string }).id).toBe(f.mine.id);

      for (const ticketId of ["POOL-2", "POOL-3"]) {
        const hidden = await app.request(`/api/task/by-ticket-id/${ticketId}`);
        expect(hidden.status).toBe(404);
      }

      const colleague = await asUser(f.colleague).request(
        "/api/task/by-ticket-id/POOL-2",
      );
      expect(colleague.status).toBe(200);
    });

    it("lists only activity on the own tasks", async () => {
      const f = await fixture();
      await seedComment(f.theirs.id, f.colleague.id, "Rückruf vereinbart");
      await seedComment(f.unassigned.id, f.colleague.id, "Pool gesichtet");
      await seedComment(f.mine.id, f.colleague.id, "Rückruf erledigt");

      const feed = async (user: typeof schema.userTable.$inferSelect) => {
        const response = await asUser(user).request(
          `/api/activity/workspace/${f.workspace.id}`,
        );
        expect(response.status).toBe(200);
        return ((await response.json()) as Array<{ taskId: string }>).map(
          (event) => event.taskId,
        );
      };

      expect(await feed(f.restricted.user)).toEqual([f.mine.id]);
      expect((await feed(f.colleague)).sort()).toEqual(
        [f.mine.id, f.theirs.id, f.unassigned.id].sort(),
      );
    });

    it("denies the project-wide integration sync scope", async () => {
      const f = await fixture();
      await db.insert(schema.integrationTable).values({
        projectId: f.project.id,
        type: "gitea",
        isActive: true,
        config: JSON.stringify({
          baseUrl: "https://git.example",
          accessToken: "test-only",
          repositoryOwner: "team",
          repositoryName: "repo",
        }),
      });
      const path = `/api/integration-sync/project/${f.project.id}/gitea`;

      expect((await asUser(f.restricted.user).request(path)).status).toBe(403);
      expect((await asUser(f.colleague).request(path)).status).toBe(200);
    });
  });

  // The board card and the filter toolbar read field values per project, not
  // per task, so the shared task lookup never sees them. Both routes must
  // apply the row filter themselves (Pegasus fork, Stufe 0 Baustein 3).
  describe("custom field values", () => {
    type ValueRow = { taskId: string; value: string | null };
    type FilterRow = { fieldId: string; values: string[] };

    async function seedRegionValues(f: Awaited<ReturnType<typeof fixture>>) {
      const field = await seedCustomField(f.project.id);
      await seedCustomFieldValue(f.mine.id, field.id, "Nord");
      await seedCustomFieldValue(f.theirs.id, field.id, "Sued");
      await seedCustomFieldValue(f.unassigned.id, field.id, "West");
      return field;
    }

    it("returns only values of the own tasks from the project values route", async () => {
      const f = await fixture();
      await seedRegionValues(f);

      const values = async (user: typeof schema.userTable.$inferSelect) => {
        const response = await asUser(user).request(
          `/api/custom-field/project/${f.project.id}/values`,
        );
        expect(response.status).toBe(200);
        return (await response.json()) as ValueRow[];
      };

      expect((await values(f.restricted.user)).map((v) => v.taskId)).toEqual([
        f.mine.id,
      ]);
      expect((await values(f.colleague)).map((v) => v.taskId).sort()).toEqual(
        [f.mine.id, f.theirs.id, f.unassigned.id].sort(),
      );
    });

    it("keeps the definitions but hides foreign values in the filter values", async () => {
      const f = await fixture();
      const field = await seedRegionValues(f);

      const filterValues = async (
        user: typeof schema.userTable.$inferSelect,
      ) => {
        const response = await asUser(user).request(
          `/api/custom-field/project/${f.project.id}/filter-values`,
        );
        expect(response.status).toBe(200);
        return (await response.json()) as FilterRow[];
      };

      const restricted = await filterValues(f.restricted.user);
      expect(restricted.map((entry) => entry.fieldId)).toEqual([field.id]);
      expect(restricted[0]?.values).toEqual(["Nord"]);

      const colleague = await filterValues(f.colleague);
      expect(colleague[0]?.values.sort()).toEqual(["Nord", "Sued", "West"]);
    });

    it("hides the task-level values and rejects writes on a foreign task", async () => {
      const f = await fixture();
      const field = await seedRegionValues(f);
      const app = asUser(f.restricted.user);

      expect(
        (await app.request(`/api/custom-field/task/${f.theirs.id}`)).status,
      ).toBe(404);
      const put = await app.request("/api/custom-field/value", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskId: f.theirs.id,
          fieldId: field.id,
          value: "Ost",
        }),
      });
      expect(put.status).toBe(404);

      const own = await app.request(`/api/custom-field/task/${f.mine.id}`);
      expect(own.status).toBe(200);
      expect(((await own.json()) as ValueRow[]).map((v) => v.value)).toEqual([
        "Nord",
      ]);
    });
  });

  describe("exemptions", () => {
    it("does not restrict an instance admin who holds the restricted role", async () => {
      const f = await fixture();
      await db
        .update(schema.userTable)
        .set({ role: "admin" })
        .where(eq(schema.userTable.id, f.restricted.user.id));
      const refreshed = await db.query.userTable.findFirst({
        where: eq(schema.userTable.id, f.restricted.user.id),
      });
      if (!refreshed) throw new Error("user vanished");
      const app = asUser(refreshed);

      const { ids } = await listTasks(app, f.project.id);
      expect(ids).toHaveLength(3);
      expect((await app.request(`/api/task/${f.theirs.id}`)).status).toBe(200);
    });

    it("applies the member role, not the key scopes, to API-key requests", async () => {
      const f = await fixture();
      const key = `test_${randomUUID()}`;
      await db.insert(schema.apikeyTable).values({
        referenceId: f.restricted.user.id,
        userId: f.restricted.user.id,
        key: createHash("sha256").update(key).digest("base64url"),
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const { app } = createApp();
      const headers = { "x-api-key": key };

      const list = await app.request(`/api/task/tasks/${f.project.id}`, {
        headers,
      });
      expect(list.status).toBe(200);
      const body = (await list.json()) as { pagination: { total: number } };
      expect(body.pagination.total).toBe(1);

      const hidden = await app.request(`/api/task/${f.theirs.id}`, { headers });
      expect(hidden.status).toBe(404);
    });
  });
});
