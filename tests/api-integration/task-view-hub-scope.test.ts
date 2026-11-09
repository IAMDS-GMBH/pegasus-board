import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import {
  type App,
  asUser,
  createHubScopeFixture,
  HUB_ROLE,
  HUB_ROLE_PERMISSION,
  type HubScopeFixture,
  type TaskName,
} from "./helpers/hub-scope-fixture";

// Pegasus fork (PEGA-141): members of a hub-scoped role see exactly the tasks
// of the units the Pegasus Hub pushed for them, on every read path, and touch
// nothing else. Tree and unit sets: helpers/hub-scope-fixture.ts.

// Background notifications would race the next test's TRUNCATE; their
// scoping is covered in notification-hub-scope.test.ts.
vi.mock(
  "../../apps/api/src/notification/controllers/create-notification",
  () => ({ default: vi.fn(async () => null) }),
);

const { readObject } = vi.hoisted(() => ({
  readObject: vi.fn(async () => ({
    body: new Uint8Array([1, 2, 3]),
    contentType: "image/png",
    contentLength: 3,
  })),
}));
vi.mock("../../apps/api/src/storage/s3", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getPrivateObject: readObject,
}));

const ALL: TaskName[] = ["L1", "L2", "L3", "L4", "L5", "L6", "M1", "N0"];

async function boardNames(f: HubScopeFixture, app: App) {
  const response = await app.request(`/api/task/tasks/${f.project.id}`);
  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    data: {
      columns: Array<{ tasks: Array<{ id: string }> }>;
      plannedTasks: Array<{ id: string }>;
      archivedTasks: Array<{ id: string }>;
    };
    pagination: { total: number };
  };
  const ids = [
    ...body.data.columns.flatMap((column) => column.tasks.map((t) => t.id)),
    ...body.data.plannedTasks.map((task) => task.id),
    ...body.data.archivedTasks.map((task) => task.id),
  ];
  expect(body.pagination.total).toBe(ids.length);
  return f.namesOf(ids);
}

async function searchResults(
  f: HubScopeFixture,
  app: App,
  q: string,
  type = "tasks",
) {
  const response = await app.request(
    `/api/search?q=${encodeURIComponent(q)}&type=${type}&workspaceId=${f.workspace.id}`,
  );
  expect(response.status).toBe(200);
  return (
    (await response.json()) as {
      results: Array<{ id: string; content?: string }>;
    }
  ).results;
}

async function seedComment(taskId: string, userId: string, content: string) {
  await db
    .insert(schema.activityTable)
    .values({ taskId, userId, type: "comment", content });
}

async function grant(f: HubScopeFixture, permission: Record<string, string[]>) {
  await db
    .update(schema.workspaceRoleTable)
    .set({ permission: JSON.stringify(permission) })
    .where(
      and(
        eq(schema.workspaceRoleTable.workspaceId, f.workspace.id),
        eq(schema.workspaceRoleTable.role, HUB_ROLE),
      ),
    );
}

describe("API integration: hub-scoped task visibility", () => {
  beforeEach(() => resetTestDatabase());

  describe("reads of a BD leader (units U3)", () => {
    it("lists only L1 and L2 on the board", async () => {
      const f = await createHubScopeFixture();

      expect(await boardNames(f, asUser(f.users.fkBD))).toEqual(["L1", "L2"]);
    });

    it("answers 404 for every other task, its description and its ticket id", async () => {
      const f = await createHubScopeFixture();
      const app = asUser(f.users.fkBD);

      for (const name of ["L3", "L4", "L5", "L6", "M1", "N0"] as const) {
        const task = f.tasks[name];
        expect((await app.request(`/api/task/${task.id}`)).status, name).toBe(
          404,
        );
        expect(
          (await app.request(`/api/task/${task.id}/description?offset=0`))
            .status,
          name,
        ).toBe(404);
        expect(
          (await app.request(`/api/task/by-ticket-id/BEW-${task.number}`))
            .status,
          name,
        ).toBe(404);
      }
      expect((await app.request(`/api/task/${f.tasks.L1.id}`)).status).toBe(
        200,
      );
      expect((await app.request("/api/task/by-ticket-id/BEW-1")).status).toBe(
        200,
      );
    });

    it("finds only L1 and L2 by title, short id and comment", async () => {
      const f = await createHubScopeFixture();
      await seedComment(f.tasks.L1.id, f.owner.id, "Rückruf vereinbart");
      await seedComment(f.tasks.L4.id, f.owner.id, "Rückruf geplant");
      const app = asUser(f.users.fkBD);

      expect(
        f.namesOf((await searchResults(f, app, "Lead")).map((r) => r.id)),
      ).toEqual(["L1", "L2"]);
      expect(await searchResults(f, app, "BEW-4")).toEqual([]);
      expect(
        (await searchResults(f, app, "Rückruf", "comments")).map(
          (r) => r.content,
        ),
      ).toEqual(["Rückruf vereinbart"]);
    });

    it("exports only L1 and L2", async () => {
      const f = await createHubScopeFixture();

      const response = await asUser(f.users.fkBD).request(
        `/api/task/export/${f.project.id}`,
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        tasks: Array<{ title: string }>;
      };
      expect(body.tasks.map((task) => task.title).sort()).toEqual([
        "Lead L1",
        "Lead L2",
      ]);
    });

    it("returns only L1 and L2 from deferred description matches", async () => {
      const f = await createHubScopeFixture();
      const longText = `${"x".repeat(70 * 1024)} Gesprächsnotiz needle`;
      for (const name of ["L1", "L4"] as const) {
        await db
          .update(schema.taskTable)
          .set({ description: longText })
          .where(eq(schema.taskTable.id, f.tasks[name].id));
      }

      const response = await asUser(f.users.fkBD).request(
        `/api/task/description-matches/${f.project.id}?query=needle`,
      );
      expect(response.status).toBe(200);
      expect(
        f.namesOf(((await response.json()) as { ids: string[] }).ids),
      ).toEqual(["L1"]);
    });

    it("returns custom field values and filter values of L1 and L2 only", async () => {
      const f = await createHubScopeFixture();
      const [field] = await db
        .insert(schema.customFieldDefinitionTable)
        .values({
          projectId: f.project.id,
          name: "Telefon",
          type: "text",
          required: false,
          position: 0,
        })
        .returning();
      for (const name of ALL) {
        await db.insert(schema.customFieldValueTable).values({
          taskId: f.tasks[name].id,
          fieldId: field.id,
          value: `tel-${name}`,
        });
      }
      const app = asUser(f.users.fkBD);

      const values = await app.request(
        `/api/custom-field/project/${f.project.id}/values`,
      );
      expect(values.status).toBe(200);
      expect(
        f.namesOf(
          ((await values.json()) as Array<{ taskId: string }>).map(
            (v) => v.taskId,
          ),
        ),
      ).toEqual(["L1", "L2"]);

      const filterValues = await app.request(
        `/api/custom-field/project/${f.project.id}/filter-values`,
      );
      expect(filterValues.status).toBe(200);
      const [entry] = (await filterValues.json()) as Array<{
        values: string[];
      }>;
      expect(entry?.values.sort()).toEqual(["tel-L1", "tel-L2"]);
    });

    it("lists workspace activity on L1 and L2 only", async () => {
      const f = await createHubScopeFixture();
      await seedComment(f.tasks.L1.id, f.owner.id, "Anruf");
      await seedComment(f.tasks.L4.id, f.owner.id, "Anruf");
      await seedComment(f.tasks.M1.id, f.owner.id, "Anruf");

      const response = await asUser(f.users.fkBD).request(
        `/api/activity/workspace/${f.workspace.id}`,
      );
      expect(response.status).toBe(200);
      expect(
        f.namesOf(
          ((await response.json()) as Array<{ taskId: string }>).map(
            (event) => event.taskId,
          ),
        ),
      ).toEqual(["L1"]);
    });
  });

  describe("unit sets and modes", () => {
    it.each([
      ["fkFD", ["L1", "L2", "L3", "L5"]],
      ["multi", ["L1", "L2", "L4", "L6"]],
      ["all", ALL],
      ["bearbeiter", ["L2"]],
      ["noRow", []],
      ["innendienst", ALL],
    ] as const)("shows %s exactly %j", async (user, expected) => {
      const f = await createHubScopeFixture();

      expect(await boardNames(f, asUser(f.users[user]))).toEqual([...expected]);
    });

    it("searches across the same set as the board", async () => {
      const f = await createHubScopeFixture();

      const results = await searchResults(f, asUser(f.users.multi), "Lead");

      expect(f.namesOf(results.map((r) => r.id))).toEqual([
        "L1",
        "L2",
        "L4",
        "L6",
      ]);
    });

    it("hides everything from a user the next snapshot leaves out", async () => {
      const f = await createHubScopeFixture();
      await f.pushScopes(
        f.defaultScopes.filter((scope) => scope.email !== "fk-bd@wwk.test"),
      );

      expect(await boardNames(f, asUser(f.users.fkBD))).toEqual([]);
    });

    it("does not restrict the owner", async () => {
      const f = await createHubScopeFixture();

      expect(await boardNames(f, asUser(f.owner))).toEqual(ALL);
    });

    it("restricts a member who holds the hub role next to member", async () => {
      const f = await createHubScopeFixture();
      await db
        .update(schema.workspaceUserTable)
        .set({ role: `member,${HUB_ROLE}` })
        .where(eq(schema.workspaceUserTable.userId, f.users.fkBD.id));

      expect(await boardNames(f, asUser(f.users.fkBD))).toEqual(["L1", "L2"]);
    });

    it("admits a task when either restriction does", async () => {
      const f = await createHubScopeFixture();
      await db
        .update(schema.workspaceRoleTable)
        .set({ assignedOnly: true })
        .where(eq(schema.workspaceRoleTable.workspaceId, f.workspace.id));
      await db
        .update(schema.taskTable)
        .set({ userId: f.users.fkBD.id })
        .where(eq(schema.taskTable.id, f.tasks.L4.id));

      expect(await boardNames(f, asUser(f.users.fkBD))).toEqual([
        "L1",
        "L2",
        "L4",
      ]);
    });

    it("denies calendar feeds and the integration sync scope", async () => {
      const f = await createHubScopeFixture();
      await grant(f, {
        ...HUB_ROLE_PERMISSION,
        project: ["read", "share"],
      });
      const app = asUser(f.users.fkBD);

      expect(
        (await app.request(`/api/calendar-feed/project/${f.project.id}`))
          .status,
      ).toBe(403);
      expect(
        (
          await app.request(
            `/api/integration-sync/project/${f.project.id}/gitea`,
          )
        ).status,
      ).toBe(403);
    });
  });

  describe("work inside the scope", () => {
    it("lets the BD leader update and move L1", async () => {
      const f = await createHubScopeFixture();
      const app = asUser(f.users.fkBD);

      const title = await app.request(`/api/task/title/${f.tasks.L1.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Lead L1 (Rückruf)" }),
      });
      expect(title.status).toBe(200);

      const move = await app.request("/api/task/reorder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: f.project.id,
          tasks: [{ id: f.tasks.L1.id, position: 0, status: "in-progress" }],
        }),
      });
      expect(move.status).toBe(200);
      const [moved] = await db
        .select({ status: schema.taskTable.status })
        .from(schema.taskTable)
        .where(eq(schema.taskTable.id, f.tasks.L1.id));
      expect(moved?.status).toBe("in-progress");
    });

    it("does not move a hidden task with a reorder", async () => {
      const f = await createHubScopeFixture();

      const response = await asUser(f.users.fkBD).request("/api/task/reorder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: f.project.id,
          tasks: [
            { id: f.tasks.L1.id, position: 0, status: "in-progress" },
            { id: f.tasks.L4.id, position: 1, status: "in-progress" },
          ],
        }),
      });

      expect(response.status).toBe(404);
      const rows = await db
        .select({ status: schema.taskTable.status })
        .from(schema.taskTable);
      expect(rows.every((row) => row.status === "to-do")).toBe(true);
    });

    it("compares a reorder snapshot against the visible tasks only", async () => {
      const f = await createHubScopeFixture();

      const response = await asUser(f.users.fkBD).request("/api/task/reorder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: f.project.id,
          expectedTasks: [
            {
              id: f.tasks.L1.id,
              position: f.tasks.L1.position,
              status: "to-do",
            },
            {
              id: f.tasks.L2.id,
              position: f.tasks.L2.position,
              status: "to-do",
            },
          ],
          tasks: [
            { id: f.tasks.L2.id, position: 0, status: "to-do" },
            { id: f.tasks.L1.id, position: 1, status: "to-do" },
          ],
        }),
      });

      expect(response.status).toBe(200);
    });
  });

  describe("attachments", () => {
    async function seedAsset(
      f: HubScopeFixture,
      target: { taskId?: string; activityId?: string },
    ) {
      const [asset] = await db
        .insert(schema.assetTable)
        .values({
          workspaceId: f.workspace.id,
          projectId: f.project.id,
          ...target,
          objectKey: randomUUID(),
          filename: "lebenslauf.png",
          mimeType: "image/png",
          size: 3,
          surface: "comment",
          createdBy: f.owner.id,
        })
        .returning();
      return asset;
    }

    it("serves attachments of visible tasks and hides those of hidden ones", async () => {
      const f = await createHubScopeFixture();
      const [comment] = await db
        .insert(schema.activityTable)
        .values({
          taskId: f.tasks.L4.id,
          userId: f.owner.id,
          type: "comment",
          content: "Lebenslauf anbei",
        })
        .returning();
      const visible = await seedAsset(f, { taskId: f.tasks.L1.id });
      const hidden = await seedAsset(f, { taskId: f.tasks.L4.id });
      const hiddenByComment = await seedAsset(f, { activityId: comment.id });
      const app = asUser(f.users.fkBD);

      expect((await app.request(`/api/asset/${visible.id}`)).status).toBe(200);
      for (const asset of [hidden, hiddenByComment]) {
        expect((await app.request(`/api/asset/${asset.id}`)).status).toBe(404);
      }
      expect(
        (await asUser(f.users.multi).request(`/api/asset/${hidden.id}`)).status,
      ).toBe(200);
    });
  });

  describe("labels, relations, counters", () => {
    it("hides labels of hidden tasks in the workspace list", async () => {
      const f = await createHubScopeFixture();
      await db.insert(schema.labelTable).values([
        { workspaceId: f.workspace.id, name: "Kampagne", color: "#009036" },
        {
          workspaceId: f.workspace.id,
          taskId: f.tasks.L1.id,
          name: "Kampagne",
          color: "#009036",
        },
        {
          workspaceId: f.workspace.id,
          taskId: f.tasks.L4.id,
          name: "Kampagne",
          color: "#009036",
        },
      ]);

      const response = await asUser(f.users.fkBD).request(
        `/api/label/workspace/${f.workspace.id}`,
      );
      expect(response.status).toBe(200);
      const labels = (await response.json()) as Array<{
        taskId: string | null;
      }>;
      expect(labels.map((label) => label.taskId).sort()).toEqual(
        [f.tasks.L1.id, null].sort(),
      );
    });

    it("does not create or attach a label on a hidden task", async () => {
      const f = await createHubScopeFixture();
      await grant(f, {
        ...HUB_ROLE_PERMISSION,
        label: ["read", "create", "update"],
      });
      const [template] = await db
        .insert(schema.labelTable)
        .values({
          workspaceId: f.workspace.id,
          name: "Kampagne",
          color: "#009036",
        })
        .returning();
      const app = asUser(f.users.fkBD);

      const created = await app.request("/api/label", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Kampagne",
          color: "#009036",
          workspaceId: f.workspace.id,
          taskId: f.tasks.L4.id,
        }),
      });
      expect(created.status).toBe(404);

      const attached = await app.request(`/api/label/${template.id}/task`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: f.tasks.L4.id }),
      });
      expect(attached.status).toBe(404);

      const onHidden = await db
        .select()
        .from(schema.labelTable)
        .where(eq(schema.labelTable.taskId, f.tasks.L4.id));
      expect(onHidden).toEqual([]);

      const visible = await app.request("/api/label", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Kampagne",
          color: "#009036",
          workspaceId: f.workspace.id,
          taskId: f.tasks.L1.id,
        }),
      });
      expect(visible.status).toBe(200);
    });

    it("hides relations to hidden tasks and refuses to create them", async () => {
      const f = await createHubScopeFixture();
      await db.insert(schema.taskRelationTable).values([
        {
          sourceTaskId: f.tasks.L1.id,
          targetTaskId: f.tasks.L4.id,
          relationType: "related",
        },
        {
          sourceTaskId: f.tasks.L1.id,
          targetTaskId: f.tasks.L2.id,
          relationType: "related",
        },
      ]);
      const app = asUser(f.users.fkBD);

      const listed = await app.request(`/api/task-relation/${f.tasks.L1.id}`);
      expect(listed.status).toBe(200);
      expect(JSON.stringify(await listed.json())).not.toContain(f.tasks.L4.id);

      const hiddenSource = await app.request(
        `/api/task-relation/${f.tasks.L4.id}`,
      );
      expect(hiddenSource.status).toBe(404);

      for (const [source, target] of [
        ["L1", "L3"],
        ["L3", "L1"],
      ] as const) {
        const created = await app.request("/api/task-relation", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sourceTaskId: f.tasks[source].id,
            targetTaskId: f.tasks[target].id,
            relationType: "blocks",
          }),
        });
        expect(created.status, `${source} → ${target}`).toBe(404);
      }
      const [hiddenRelation] = await db
        .select({ id: schema.taskRelationTable.id })
        .from(schema.taskRelationTable)
        .where(eq(schema.taskRelationTable.targetTaskId, f.tasks.L4.id));
      expect(
        (
          await app.request(`/api/task-relation/${hiddenRelation?.id}`, {
            method: "DELETE",
          })
        ).status,
      ).toBe(404);
    });

    it("counts only visible tasks in the project statistics", async () => {
      const f = await createHubScopeFixture();

      const response = await asUser(f.users.fkBD).request(
        `/api/project?workspaceId=${f.workspace.id}`,
      );
      expect(response.status).toBe(200);
      const [project] = (await response.json()) as Array<{
        statistics: { totalTasks: number };
      }>;
      expect(project?.statistics.totalTasks).toBe(2);
    });

    it("counts only visible subtasks and hides hidden parents", async () => {
      const f = await createHubScopeFixture();
      await db.insert(schema.taskRelationTable).values([
        {
          sourceTaskId: f.tasks.L1.id,
          targetTaskId: f.tasks.L2.id,
          relationType: "subtask",
        },
        {
          sourceTaskId: f.tasks.L1.id,
          targetTaskId: f.tasks.L4.id,
          relationType: "subtask",
        },
        {
          sourceTaskId: f.tasks.L6.id,
          targetTaskId: f.tasks.L1.id,
          relationType: "subtask",
        },
      ]);
      const app = asUser(f.users.fkBD);

      const response = await app.request(
        `/api/task/${f.tasks.L1.id}?view=board`,
      );
      expect(response.status).toBe(200);
      const task = (await response.json()) as {
        subtaskCounts: { total: number };
        parentSubtaskCounts: Array<{ taskId: string }>;
      };
      expect(task.subtaskCounts.total).toBe(1);
      expect(task.parentSubtaskCounts).toEqual([]);

      const board = await app.request(`/api/task/tasks/${f.project.id}`);
      const body = (await board.json()) as {
        data: {
          columns: Array<{
            tasks: Array<{ id: string; subtaskCounts: { total: number } }>;
          }>;
        };
      };
      const l1 = body.data.columns
        .flatMap((column) => column.tasks)
        .find((entry) => entry.id === f.tasks.L1.id);
      expect(l1?.subtaskCounts.total).toBe(1);
    });
  });
});
