import { createHash, randomUUID } from "node:crypto";
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
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { readErrorBody } from "./helpers/error-body";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

// Pegasus fork (PEGA-141): the push API the Pegasus Hub calls to hand the
// board each user's visibility and each card's unit.

type User = typeof schema.userTable.$inferSelect;

async function addMember(workspaceId: string, role: string) {
  const id = `user-${randomUUID()}`;
  const [user] = await db
    .insert(schema.userTable)
    .values({ id, email: `${id}@example.com`, emailVerified: true, name: id })
    .returning();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: user.id,
    role,
    joinedAt: new Date(),
  });
  return user;
}

async function seedTask(projectId: string, columnId: string, number: number) {
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId,
      columnId,
      title: `Bewerber ${number}`,
      status: "to-do",
      priority: "medium",
      number,
      position: number,
    })
    .returning();
  return task;
}

async function fixture() {
  const hub = await createWorkspaceMember({ role: "admin" });
  // PEGA-142: an admin the variable does not name is governed after the
  // first push and may not push again (hub-push-api-guard.test.ts).
  vi.stubEnv("PEGASUS_HUB_USER_ID", hub.user.id);
  const member = await addMember(hub.workspace.id, "member");
  const { project, columns } = await createProjectFixture({
    workspaceId: hub.workspace.id,
    slug: "pool",
  });
  const first = await seedTask(project.id, columns.todo.id, 1);
  const second = await seedTask(project.id, columns.todo.id, 2);

  const other = await createWorkspaceMember({ role: "owner" });
  const otherProject = await createProjectFixture({
    workspaceId: other.workspace.id,
    slug: "other",
  });
  const foreign = await seedTask(
    otherProject.project.id,
    otherProject.columns.todo.id,
    1,
  );

  return {
    hub: hub.user,
    workspace: hub.workspace,
    member,
    first,
    second,
    foreign,
  };
}

function as(user: User) {
  mockAuthenticatedSession(user);
  return createApp().app;
}

function put(app: ReturnType<typeof as>, path: string, body: unknown) {
  return app.request(`/api/pegasus-visibility${path}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function storedScopes(workspaceId: string) {
  const scopes = await db
    .select()
    .from(schema.pegasusUserScopeTable)
    .where(eq(schema.pegasusUserScopeTable.workspaceId, workspaceId));
  const units = await db
    .select()
    .from(schema.pegasusUserScopeUnitTable)
    .where(eq(schema.pegasusUserScopeUnitTable.workspaceId, workspaceId));
  return scopes
    .map((scope) => ({
      email: scope.email,
      mode: scope.mode,
      permissions: scope.permissions,
      unitIds: units
        .filter((unit) => unit.email === scope.email)
        .map((unit) => unit.unitId)
        .sort(),
    }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

async function storedTaskUnits() {
  const rows = await db.select().from(schema.pegasusTaskUnitTable);
  return Object.fromEntries(rows.map((row) => [row.taskId, row.unitId]));
}

describe("pegasus visibility API", () => {
  beforeEach(() => resetTestDatabase());
  afterEach(() => vi.unstubAllEnvs());

  describe("user scopes", () => {
    it("stores a snapshot and returns it", async () => {
      const f = await fixture();
      const app = as(f.hub);

      const response = await put(app, `/workspace/${f.workspace.id}/users`, {
        users: [
          {
            email: " FK-BD@WWK.de ",
            mode: "units",
            unitIds: ["U3"],
            permissions: [],
          },
          { email: "admin@wwk.de", mode: "all", unitIds: [], permissions: [] },
          {
            email: "bearbeiter@wwk.de",
            mode: "assigned",
            unitIds: [],
            permissions: [],
          },
        ],
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ users: 3 });
      expect(await storedScopes(f.workspace.id)).toEqual([
        { email: "admin@wwk.de", mode: "all", unitIds: [], permissions: [] },
        {
          email: "bearbeiter@wwk.de",
          mode: "assigned",
          unitIds: [],
          permissions: [],
        },
        {
          email: "fk-bd@wwk.de",
          mode: "units",
          unitIds: ["U3"],
          permissions: [],
        },
      ]);

      const read = await app.request(
        `/api/pegasus-visibility/workspace/${f.workspace.id}/users`,
      );
      expect(read.status).toBe(200);
      const body = (await read.json()) as {
        users: Array<{
          email: string;
          mode: string;
          unitIds: string[];
          permissions: string[];
        }>;
      };
      expect(
        body.users.map(({ email, mode, unitIds, permissions }) => ({
          email,
          mode,
          unitIds,
          permissions,
        })),
      ).toEqual([
        { email: "admin@wwk.de", mode: "all", unitIds: [], permissions: [] },
        {
          email: "bearbeiter@wwk.de",
          mode: "assigned",
          unitIds: [],
          permissions: [],
        },
        {
          email: "fk-bd@wwk.de",
          mode: "units",
          unitIds: ["U3"],
          permissions: [],
        },
      ]);
    });

    // Pegasus fork (PEGA-142): the effective rights the Hub computed per user.
    it("stores and returns permissions, including keys the board does not know", async () => {
      const f = await fixture();
      const app = as(f.hub);

      const response = await put(app, `/workspace/${f.workspace.id}/users`, {
        users: [
          {
            email: "fk-bd@wwk.de",
            mode: "units",
            unitIds: ["U3"],
            permissions: [
              "LEAD_READ",
              "LEAD_EDIT",
              "FUTURE_RIGHT",
              "LEAD_EDIT",
            ],
          },
          { email: "leser@wwk.de", mode: "all", unitIds: [], permissions: [] },
        ],
      });
      expect(response.status).toBe(200);

      const read = await app.request(
        `/api/pegasus-visibility/workspace/${f.workspace.id}/users`,
      );
      const body = (await read.json()) as {
        users: Array<{ email: string; permissions: string[] }>;
      };
      expect(
        body.users.map(({ email, permissions }) => ({ email, permissions })),
      ).toEqual([
        {
          email: "fk-bd@wwk.de",
          permissions: ["FUTURE_RIGHT", "LEAD_EDIT", "LEAD_READ"],
        },
        { email: "leser@wwk.de", permissions: [] },
      ]);
    });

    it("rejects a snapshot without permissions and keeps the stored one", async () => {
      const f = await fixture();
      const app = as(f.hub);
      await put(app, `/workspace/${f.workspace.id}/users`, {
        users: [
          { email: "keep@wwk.de", mode: "all", unitIds: [], permissions: [] },
        ],
      });

      const response = await put(app, `/workspace/${f.workspace.id}/users`, {
        users: [{ email: "old-hub@wwk.de", mode: "all", unitIds: [] }],
      });

      expect(response.status).toBe(400);
      expect(await storedScopes(f.workspace.id)).toEqual([
        { email: "keep@wwk.de", mode: "all", unitIds: [], permissions: [] },
      ]);
    });

    it("replaces the previous snapshot completely", async () => {
      const f = await fixture();
      const app = as(f.hub);
      await put(app, `/workspace/${f.workspace.id}/users`, {
        users: [
          {
            email: "fk-bd@wwk.de",
            mode: "units",
            unitIds: ["U3"],
            permissions: [],
          },
          { email: "gone@wwk.de", mode: "all", unitIds: [], permissions: [] },
        ],
      });

      const response = await put(app, `/workspace/${f.workspace.id}/users`, {
        users: [
          {
            email: "fk-bd@wwk.de",
            mode: "units",
            unitIds: ["U2", "U4"],
            permissions: [],
          },
        ],
      });

      expect(response.status).toBe(200);
      expect(await storedScopes(f.workspace.id)).toEqual([
        {
          email: "fk-bd@wwk.de",
          mode: "units",
          unitIds: ["U2", "U4"],
          permissions: [],
        },
      ]);
    });

    it("leaves other workspaces' snapshots alone", async () => {
      const f = await fixture();
      const other = await createWorkspaceMember({ role: "owner" });
      await put(as(other.user), `/workspace/${other.workspace.id}/users`, {
        users: [
          { email: "x@wwk.de", mode: "all", unitIds: [], permissions: [] },
        ],
      });

      await put(as(f.hub), `/workspace/${f.workspace.id}/users`, { users: [] });

      expect(await storedScopes(other.workspace.id)).toHaveLength(1);
    });

    it.each([
      [
        "a duplicate email",
        [
          { email: "a@wwk.de", mode: "all", unitIds: [], permissions: [] },
          { email: "A@wwk.de", mode: "assigned", unitIds: [], permissions: [] },
        ],
      ],
      [
        "units on a mode other than units",
        [
          {
            email: "a@wwk.de",
            mode: "assigned",
            unitIds: ["U3"],
            permissions: [],
          },
        ],
      ],
      [
        "an unknown mode",
        [{ email: "a@wwk.de", mode: "team", unitIds: [], permissions: [] }],
      ],
      [
        "an invalid email",
        [{ email: "not-an-email", mode: "all", unitIds: [], permissions: [] }],
      ],
    ])("rejects %s with 400 and writes nothing", async (_case, users) => {
      const f = await fixture();
      const app = as(f.hub);
      await put(app, `/workspace/${f.workspace.id}/users`, {
        users: [
          { email: "keep@wwk.de", mode: "all", unitIds: [], permissions: [] },
        ],
      });

      const response = await put(app, `/workspace/${f.workspace.id}/users`, {
        users,
      });

      expect(response.status).toBe(400);
      expect(await storedScopes(f.workspace.id)).toEqual([
        { email: "keep@wwk.de", mode: "all", unitIds: [], permissions: [] },
      ]);
    });

    it("denies members without workspace settings rights", async () => {
      const f = await fixture();
      const app = as(f.member);

      const write = await put(app, `/workspace/${f.workspace.id}/users`, {
        users: [
          { email: "x@wwk.de", mode: "all", unitIds: [], permissions: [] },
        ],
      });
      const read = await app.request(
        `/api/pegasus-visibility/workspace/${f.workspace.id}/users`,
      );

      expect(write.status).toBe(403);
      expect(read.status).toBe(403);
      expect(await storedScopes(f.workspace.id)).toEqual([]);
    });

    it("accepts the Hub's API key", async () => {
      const f = await fixture();
      const key = `test_${randomUUID()}`;
      await db.insert(schema.apikeyTable).values({
        referenceId: f.hub.id,
        userId: f.hub.id,
        key: createHash("sha256").update(key).digest("base64url"),
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await createApp().app.request(
        `/api/pegasus-visibility/workspace/${f.workspace.id}/users`,
        {
          method: "PUT",
          headers: { "content-type": "application/json", "x-api-key": key },
          body: JSON.stringify({
            users: [
              {
                email: "fk@wwk.de",
                mode: "units",
                unitIds: ["U3"],
                permissions: [],
              },
            ],
          }),
        },
      );

      expect(response.status).toBe(200);
    });
  });

  describe("task units", () => {
    it("sets and removes the unit of a task", async () => {
      const f = await fixture();
      const app = as(f.hub);

      const set = await put(app, `/task/${f.first.id}/unit`, { unitId: "U3" });
      expect(set.status).toBe(200);
      expect(await set.json()).toEqual({ taskId: f.first.id, unitId: "U3" });

      await put(app, `/task/${f.first.id}/unit`, { unitId: "U4" });
      expect(await storedTaskUnits()).toEqual({ [f.first.id]: "U4" });

      const removed = await put(app, `/task/${f.first.id}/unit`, {
        unitId: null,
      });
      expect(removed.status).toBe(200);
      expect(await removed.json()).toEqual({
        taskId: f.first.id,
        unitId: null,
      });
      expect(await storedTaskUnits()).toEqual({});
    });

    it("answers 404 for an unknown task", async () => {
      const f = await fixture();

      const response = await put(as(f.hub), `/task/missing-task/unit`, {
        unitId: "U3",
      });

      expect(response.status).toBe(404);
    });

    it("denies members without workspace settings rights", async () => {
      const f = await fixture();

      const response = await put(as(f.member), `/task/${f.first.id}/unit`, {
        unitId: "U3",
      });

      expect(response.status).toBe(403);
      expect(await storedTaskUnits()).toEqual({});
    });

    it("upserts many units and keeps tasks that are not listed", async () => {
      const f = await fixture();
      const app = as(f.hub);
      await put(app, `/task/${f.second.id}/unit`, { unitId: "U4" });
      await put(app, `/task/${f.first.id}/unit`, { unitId: "U1" });

      const response = await put(app, `/workspace/${f.workspace.id}/tasks`, {
        tasks: [{ taskId: f.first.id, unitId: "U3" }],
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ tasks: 1 });
      expect(await storedTaskUnits()).toEqual({
        [f.first.id]: "U3",
        [f.second.id]: "U4",
      });
    });

    it("rejects unknown and foreign tasks by id and writes nothing", async () => {
      const f = await fixture();

      const response = await put(
        as(f.hub),
        `/workspace/${f.workspace.id}/tasks`,
        {
          tasks: [
            { taskId: f.first.id, unitId: "U3" },
            { taskId: f.foreign.id, unitId: "U3" },
            { taskId: "missing-task", unitId: "U3" },
          ],
        },
      );

      expect(response.status).toBe(400);
      const body = await readErrorBody(response);
      expect(body.message).toContain(f.foreign.id);
      expect(body.message).toContain("missing-task");
      expect(body.message).not.toContain(f.first.id);
      expect(await storedTaskUnits()).toEqual({});
    });

    it("rejects a task listed twice", async () => {
      const f = await fixture();

      const response = await put(
        as(f.hub),
        `/workspace/${f.workspace.id}/tasks`,
        {
          tasks: [
            { taskId: f.first.id, unitId: "U3" },
            { taskId: f.first.id, unitId: "U4" },
          ],
        },
      );

      expect(response.status).toBe(400);
      expect(await storedTaskUnits()).toEqual({});
    });

    it("denies bulk writes to members without workspace settings rights", async () => {
      const f = await fixture();

      const response = await put(
        as(f.member),
        `/workspace/${f.workspace.id}/tasks`,
        {
          tasks: [{ taskId: f.first.id, unitId: "U3" }],
        },
      );

      expect(response.status).toBe(403);
    });
  });
});
