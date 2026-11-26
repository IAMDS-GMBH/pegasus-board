import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { scopedReorderPayloads } from "../../apps/api/src/ws/scoped-reorder";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import {
  type App,
  asUser,
  createHubScopeFixture,
  HUB_ROLE,
  HUB_ROLE_PERMISSION,
  type HubScopeFixture,
  LEAD_RIGHTS,
  type User,
} from "./helpers/hub-scope-fixture";

// Pegasus fork (PEGA-170, Nachtrag 26.11.2026): restricted columns (the
// technical stages before Qualifizierung) and their cards are seen only by
// members whose Hub rights include LEAD_READ_INTAKE, and by owners, instance
// admins and the Hub's system account. Everyone else meets them nowhere and
// cannot put a card into one.

// Background notifications would race the next test's TRUNCATE; their
// filtering is covered in notification-hub-scope.test.ts.
vi.mock(
  "../../apps/api/src/notification/controllers/create-notification",
  () => ({ default: vi.fn(async () => null) }),
);
vi.mock("../../apps/api/src/storage/s3", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getPrivateObject: vi.fn(async () => ({
    body: new Uint8Array([1, 2, 3]),
    contentType: "image/png",
    contentLength: 3,
  })),
}));

beforeEach(resetTestDatabase);
afterEach(() => vi.unstubAllEnvs());

type Column = typeof schema.columnTable.$inferSelect;

function send(app: App, method: string, path: string, body?: unknown) {
  return app.request(`/api${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function addColumn(
  projectId: string,
  slug: string,
  position: number,
  flags: { isLocked?: boolean; isRestricted?: boolean } = {},
) {
  const [column] = await db
    .insert(schema.columnTable)
    .values({ projectId, name: slug, slug, position, ...flags })
    .returning();
  return column;
}

async function putInColumn(taskId: string, column: Column) {
  await db
    .update(schema.taskTable)
    .set({ status: column.slug, columnId: column.id })
    .where(eq(schema.taskTable.id, taskId));
}

const statusOf = async (taskId: string) =>
  (
    await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, taskId),
    })
  )?.status;

// fkBD sees units U3 (L1, L2) and holds every lead right but LEAD_READ_INTAKE.
// L1 waits in the Pegasus-Pool (restricted), L2 is in Qualifizierung. The
// other project has a restricted column of its own.
async function setup() {
  const f = await createHubScopeFixture();
  const eingang = await addColumn(f.project.id, "eingang", 10, {
    isLocked: true,
    isRestricted: true,
  });
  const manuell = await addColumn(f.project.id, "manuelle-anreicherung", 11, {
    isRestricted: true,
  });
  const pool = await addColumn(f.project.id, "pegasus-pool", 12, {
    isRestricted: true,
  });
  const qualifizierung = await addColumn(f.project.id, "qualifizierung", 13);
  await putInColumn(f.tasks.L1.id, pool);
  await putInColumn(f.tasks.L2.id, qualifizierung);
  const other = await createProjectFixture({
    workspaceId: f.workspace.id,
    slug: "other",
  });
  await addColumn(other.project.id, "pegasus-pool", 10, { isRestricted: true });
  return { f, other, eingang, manuell, pool, qualifizierung };
}

type Fixture = Awaited<ReturnType<typeof setup>>;

const RESTRICTED = ["eingang", "manuelle-anreicherung", "pegasus-pool"];

async function board(f: HubScopeFixture, app: App) {
  const response = await app.request(`/api/task/tasks/${f.project.id}`);
  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    data: {
      columns: Array<{
        slug: string;
        isRestricted: boolean;
        tasks: Array<{ id: string }>;
      }>;
    };
    pagination: { total: number };
  };
  const ids = body.data.columns.flatMap((c) => c.tasks.map((t) => t.id));
  return {
    slugs: body.data.columns.map((c) => c.slug),
    names: f.namesOf(ids),
    total: body.pagination.total,
  };
}

async function grantIntake(f: HubScopeFixture, email: string) {
  await f.pushPermissions(email, [...LEAD_RIGHTS, "LEAD_READ_INTAKE"]);
}

describe("restricted columns", () => {
  describe("reads of a leader without LEAD_READ_INTAKE", () => {
    it("shows neither the restricted columns nor their cards on the board", async () => {
      const { f } = await setup();

      const seen = await board(f, asUser(f.users.fkBD));

      expect(seen.slugs).not.toEqual(expect.arrayContaining(["eingang"]));
      for (const slug of RESTRICTED) expect(seen.slugs).not.toContain(slug);
      expect(seen.slugs).toContain("qualifizierung");
      expect(seen.names).toEqual(["L2"]);
      expect(seen.total).toBe(1);
    });

    it("leaves the restricted columns out of the column list", async () => {
      const { f } = await setup();

      const response = await asUser(f.users.fkBD).request(
        `/api/column/${f.project.id}`,
      );

      expect(response.status).toBe(200);
      const slugs = ((await response.json()) as Array<{ slug: string }>).map(
        (c) => c.slug,
      );
      for (const slug of RESTRICTED) expect(slugs).not.toContain(slug);
      expect(slugs).toContain("qualifizierung");
    });

    it("answers 404 for a card in a restricted column by id, link, description, history and comments", async () => {
      const { f } = await setup();
      const app = asUser(f.users.fkBD);
      const L1 = f.tasks.L1;

      for (const path of [
        `/api/task/${L1.id}`,
        `/api/task/by-ticket-id/BEW-${L1.number}`,
        `/api/task/${L1.id}/description?offset=0`,
        `/api/activity/${L1.id}`,
        `/api/comment/${L1.id}`,
      ]) {
        expect((await app.request(path)).status, path).toBe(404);
      }
      expect((await app.request(`/api/task/${f.tasks.L2.id}`)).status).toBe(
        200,
      );
    });

    it("finds no card of a restricted column by title, short id or comment", async () => {
      const { f } = await setup();
      for (const name of ["L1", "L2"] as const) {
        await db.insert(schema.activityTable).values({
          taskId: f.tasks[name].id,
          userId: f.owner.id,
          type: "comment",
          content: `Rückruf ${name}`,
        });
      }
      const app = asUser(f.users.fkBD);
      const search = async (q: string, type: string) =>
        (
          (await (
            await app.request(
              `/api/search?q=${encodeURIComponent(q)}&type=${type}&workspaceId=${f.workspace.id}`,
            )
          ).json()) as { results: Array<{ id: string; content?: string }> }
        ).results;

      expect(
        f.namesOf((await search("Lead", "tasks")).map((r) => r.id)),
      ).toEqual(["L2"]);
      expect(await search(`BEW-${f.tasks.L1.number}`, "tasks")).toEqual([]);
      expect(
        (await search("Rückruf", "comments")).map((r) => r.content),
      ).toEqual(["Rückruf L2"]);
    });

    it("counts no card of a restricted column in the project statistics", async () => {
      const { f } = await setup();

      const response = await asUser(f.users.fkBD).request(
        `/api/project?workspaceId=${f.workspace.id}`,
      );

      expect(response.status).toBe(200);
      const [project] = (await response.json()) as Array<{
        statistics: { totalTasks: number };
      }>;
      expect(project?.statistics.totalTasks).toBe(1);
    });

    it("leaves own cards in a restricted column out of My tasks and its badge", async () => {
      const { f } = await setup();
      for (const name of ["L1", "L2"] as const) {
        await db
          .update(schema.taskTable)
          .set({ userId: f.users.fkBD.id })
          .where(eq(schema.taskTable.id, f.tasks[name].id));
      }
      const app = asUser(f.users.fkBD);

      const list = await app.request(
        `/api/task/assigned?workspaceId=${f.workspace.id}`,
      );
      const badge = await app.request(
        `/api/task/assigned?workspaceId=${f.workspace.id}&countOnly=true`,
      );

      expect(list.status).toBe(200);
      const body = (await list.json()) as {
        tasks: Array<{ id: string }>;
        total: number;
      };
      expect(f.namesOf(body.tasks.map((t) => t.id))).toEqual(["L2"]);
      expect(body.total).toBe(1);
      expect(((await badge.json()) as { total: number }).total).toBe(1);
    });

    it("counts no subtask and shows no relation in a restricted column", async () => {
      const { f } = await setup();
      for (const relationType of ["subtask", "related"]) {
        await db.insert(schema.taskRelationTable).values({
          sourceTaskId: f.tasks.L2.id,
          targetTaskId: f.tasks.L1.id,
          relationType,
        });
      }
      const app = asUser(f.users.fkBD);

      const task = (await (
        await app.request(`/api/task/${f.tasks.L2.id}?view=board`)
      ).json()) as { subtaskCounts?: { total: number } };
      const relations = (await (
        await app.request(`/api/task-relation/${f.tasks.L2.id}`)
      ).json()) as unknown[];

      expect(task.subtaskCounts?.total ?? 0).toBe(0);
      expect(relations).toEqual([]);
    });

    it("hides moves through restricted columns from a released card's history and the workspace feed", async () => {
      const { f } = await setup();
      const L2 = f.tasks.L2.id;
      await db.insert(schema.activityTable).values([
        {
          taskId: L2,
          userId: f.owner.id,
          type: "status_changed",
          eventData: { oldStatus: "eingang", newStatus: "pegasus-pool" },
        },
        {
          taskId: L2,
          userId: f.owner.id,
          type: "status_changed",
          eventData: { oldStatus: "pegasus-pool", newStatus: "qualifizierung" },
        },
        {
          taskId: L2,
          userId: f.owner.id,
          type: "status_changed",
          eventData: { oldStatus: "qualifizierung", newStatus: "to-do" },
        },
        { taskId: L2, userId: f.owner.id, type: "comment", content: "Anruf" },
      ]);
      const typesOf = async (app: App, path: string) => {
        const response = await app.request(path);
        expect(response.status, path).toBe(200);
        return (
          (await response.json()) as Array<{
            type: string;
            eventData: { newStatus?: string } | null;
          }>
        )
          .map((a) => `${a.type}:${a.eventData?.newStatus ?? ""}`)
          .sort();
      };

      const leader = asUser(f.users.fkBD);
      expect(await typesOf(leader, `/api/activity/${L2}`)).toEqual([
        "comment:",
        "status_changed:to-do",
      ]);
      expect(
        await typesOf(leader, `/api/activity/workspace/${f.workspace.id}`),
      ).toEqual(["comment:", "status_changed:to-do"]);
      expect(
        await typesOf(asUser(f.owner), `/api/activity/${L2}`),
      ).toHaveLength(4);
    });

    it("finds no moves through restricted columns in the activity search", async () => {
      const { f } = await setup();
      await db.insert(schema.activityTable).values({
        taskId: f.tasks.L2.id,
        userId: f.owner.id,
        type: "status_changed",
        eventData: { oldStatus: "pegasus-pool", newStatus: "qualifizierung" },
      });
      const search = async (user: User) =>
        (
          (await (
            await asUser(user).request(
              `/api/search?q=qualifizierung&type=activities&workspaceId=${f.workspace.id}`,
            )
          ).json()) as { results: unknown[] }
        ).results;

      expect(await search(f.users.fkBD)).toEqual([]);
      expect(await search(f.owner)).toHaveLength(1);
    });

    it("serves no attachment of a card in a restricted column", async () => {
      const { f } = await setup();
      const [asset] = await db
        .insert(schema.assetTable)
        .values({
          workspaceId: f.workspace.id,
          projectId: f.project.id,
          taskId: f.tasks.L1.id,
          objectKey: randomUUID(),
          filename: "lebenslauf.png",
          mimeType: "image/png",
          size: 3,
          surface: "comment",
          createdBy: f.owner.id,
        })
        .returning();

      expect(
        (await asUser(f.users.fkBD).request(`/api/asset/${asset.id}`)).status,
      ).toBe(404);
      expect(
        (await asUser(f.owner).request(`/api/asset/${asset.id}`)).status,
      ).toBe(200);
    });

    it("exports no card of a restricted column", async () => {
      const { f } = await setup();

      const response = await asUser(f.users.fkBD).request(
        `/api/task/export/${f.project.id}`,
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        tasks: Array<{ title: string }>;
      };
      expect(body.tasks.map((t) => t.title)).toEqual(["Lead L2"]);
    });

    it("returns no field value of a card in a restricted column", async () => {
      const { f } = await setup();
      const [field] = await db
        .insert(schema.customFieldDefinitionTable)
        .values({ projectId: f.project.id, name: "Telefon", type: "text" })
        .returning();
      for (const name of ["L1", "L2"] as const) {
        await db.insert(schema.customFieldValueTable).values({
          taskId: f.tasks[name].id,
          fieldId: field.id,
          value: `tel-${name}`,
        });
      }

      const response = await asUser(f.users.fkBD).request(
        `/api/custom-field/project/${f.project.id}/values`,
      );

      expect(response.status).toBe(200);
      expect(
        f.namesOf(
          ((await response.json()) as Array<{ taskId: string }>).map(
            (v) => v.taskId,
          ),
        ),
      ).toEqual(["L2"]);
    });

    it("hides workflow rules into restricted columns", async () => {
      const x = await setup();
      for (const column of [x.pool, x.qualifizierung]) {
        await db.insert(schema.workflowRuleTable).values({
          projectId: x.f.project.id,
          integrationType: "github",
          eventType: `event-${column.slug}`,
          columnId: column.id,
        });
      }

      const response = await asUser(x.f.users.fkBD).request(
        `/api/workflow-rule/${x.f.project.id}`,
      );

      expect(response.status).toBe(200);
      expect(
        ((await response.json()) as Array<{ columnSlug: string }>).map(
          (r) => r.columnSlug,
        ),
      ).toEqual(["qualifizierung"]);
    });

    it("answers 404 when a member who may manage columns edits or deletes a restricted one", async () => {
      const x = await setup();
      await db
        .update(schema.workspaceRoleTable)
        .set({
          permission: JSON.stringify({
            ...HUB_ROLE_PERMISSION,
            project: ["read", "update"],
          }),
        })
        .where(
          and(
            eq(schema.workspaceRoleTable.workspaceId, x.f.workspace.id),
            eq(schema.workspaceRoleTable.role, HUB_ROLE),
          ),
        );
      const app = asUser(x.f.users.fkBD);

      const edited = await send(app, "PUT", `/column/${x.pool.id}`, {
        isRestricted: false,
      });
      const deleted = await send(app, "DELETE", `/column/${x.manuell.id}`);
      const visible = await send(app, "PUT", `/column/${x.qualifizierung.id}`, {
        phase: "Kontaktaufnahme und Qualifizierung",
      });

      expect(edited.status).toBe(404);
      expect(deleted.status).toBe(404);
      expect(visible.status).toBe(200);
      const pool = await db.query.columnTable.findFirst({
        where: eq(schema.columnTable.id, x.pool.id),
      });
      expect(pool?.isRestricted).toBe(true);
    });

    it("never shows restricted columns or their cards on a public board", async () => {
      const { f } = await setup();
      await db
        .update(schema.projectTable)
        .set({ isPublic: true })
        .where(eq(schema.projectTable.id, f.project.id));
      const app = asUser(f.owner);

      const response = await app.request(`/api/public-project/${f.project.id}`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        columns: Array<{ slug: string; tasks: Array<{ id: string }> }>;
      };
      for (const slug of RESTRICTED) {
        expect(body.columns.map((c) => c.slug)).not.toContain(slug);
      }
      expect(
        body.columns.flatMap((c) => c.tasks.map((t) => t.id)),
      ).not.toContain(f.tasks.L1.id);
      expect(
        (
          await app.request(
            `/api/public-project/${f.project.id}/task/${f.tasks.L1.id}/description?offset=0`,
          )
        ).status,
      ).toBe(404);
    });

    it("sends a reorder naming a hidden card as a plain refresh", async () => {
      const { f } = await setup();
      const message = {
        type: "TASKS_REORDERED",
        projectId: f.project.id,
        tasks: [
          { id: f.tasks.L1.id, position: 1, status: "pegasus-pool" },
          { id: f.tasks.L2.id, position: 2, status: "qualifizierung" },
        ],
      };

      const payloads = await scopedReorderPayloads(
        f.workspace.id,
        [f.owner.id, f.users.fkBD.id],
        message,
      );
      const visibleOnly = await scopedReorderPayloads(
        f.workspace.id,
        [f.users.fkBD.id],
        { ...message, tasks: [message.tasks[1]] },
      );

      expect(payloads.has(f.owner.id)).toBe(false);
      expect(JSON.parse(payloads.get(f.users.fkBD.id) ?? "null")).toEqual({
        type: "PROJECT_UPDATED",
        projectId: f.project.id,
      });
      expect(visibleOnly.size).toBe(0);
    });
  });

  describe("putting a card into a restricted column", () => {
    const fullUpdate = (x: Fixture, status: string) => ({
      title: "Lead",
      priority: "medium",
      status,
      projectId: x.f.project.id,
      position: 1,
    });

    const REFUSED: Array<
      [string, (x: Fixture, app: App) => Promise<Response>]
    > = [
      [
        "updateTaskStatus",
        (x, app) =>
          send(app, "PUT", `/task/status/${x.f.tasks.L2.id}`, {
            status: "pegasus-pool",
          }),
      ],
      [
        "updateTask",
        (x, app) =>
          send(
            app,
            "PUT",
            `/task/${x.f.tasks.L2.id}`,
            fullUpdate(x, "manuelle-anreicherung"),
          ),
      ],
      [
        "reorderTasks",
        (x, app) =>
          send(app, "POST", "/task/reorder", {
            projectId: x.f.project.id,
            tasks: [
              { id: x.f.tasks.L2.id, position: 1, status: "pegasus-pool" },
            ],
          }),
      ],
      [
        "bulk updateStatus",
        (x, app) =>
          send(app, "PATCH", "/task/bulk", {
            taskIds: [x.f.tasks.L2.id],
            operation: "updateStatus",
            value: "pegasus-pool",
          }),
      ],
      [
        "moveTask into another project's restricted column",
        (x, app) =>
          send(app, "PUT", `/task/move/${x.f.tasks.L2.id}`, {
            destinationProjectId: x.other.project.id,
            destinationStatus: "pegasus-pool",
          }),
      ],
      [
        "createTask",
        (x, app) =>
          send(app, "POST", `/task/${x.f.project.id}`, {
            title: "Neu",
            description: "",
            priority: "medium",
            status: "manuelle-anreicherung",
          }),
      ],
      [
        "createTask in a column that is also locked",
        (x, app) =>
          send(app, "POST", `/task/${x.f.project.id}`, {
            title: "Neu",
            description: "",
            priority: "medium",
            status: "eingang",
          }),
      ],
      [
        "importTasks",
        (x, app) =>
          send(app, "POST", `/task/import/${x.f.project.id}`, {
            tasks: [
              { title: "Neu", status: "qualifizierung" },
              { title: "Neu 2", status: "pegasus-pool" },
            ],
          }),
      ],
    ];

    it.each(REFUSED)(
      "refuses %s like an unknown status",
      async (_name, request) => {
        const x = await setup();
        const before = await db.$count(schema.taskTable);

        const response = await request(x, asUser(x.f.users.fkBD));

        expect(response.status).toBe(400);
        const text = await response.text();
        expect(text).toContain("Invalid status");
        expect(text).not.toContain("COLUMN_LOCKED");
        expect(await statusOf(x.f.tasks.L2.id)).toBe("qualifizierung");
        expect(await db.$count(schema.taskTable)).toBe(before);
      },
    );

    it("answers 404 to taking a hidden card out of a restricted column", async () => {
      const x = await setup();

      const response = await send(
        asUser(x.f.users.fkBD),
        "PUT",
        `/task/status/${x.f.tasks.L1.id}`,
        { status: "qualifizierung" },
      );

      expect(response.status).toBe(404);
      expect(await statusOf(x.f.tasks.L1.id)).toBe("pegasus-pool");
    });
  });

  describe("who sees everything", () => {
    async function addUser(f: HubScopeFixture, id: string, role = "admin") {
      const [user] = await db
        .insert(schema.userTable)
        .values({ id, email: `${id}@wwk.test`, emailVerified: true, name: id })
        .returning();
      await db.insert(schema.workspaceUserTable).values({
        workspaceId: f.workspace.id,
        userId: user.id,
        role,
        joinedAt: new Date(),
      });
      return user;
    }

    const SEES_ALL: Array<[string, (f: HubScopeFixture) => Promise<User>]> = [
      [
        "a member with LEAD_READ_INTAKE",
        async (f) => {
          await grantIntake(f, "fk-bd@wwk.test");
          return f.users.fkBD;
        },
      ],
      ["the owner", async (f) => f.owner],
      [
        "an instance admin",
        async (f) => {
          await db
            .update(schema.userTable)
            .set({ role: "admin" })
            .where(eq(schema.userTable.id, f.users.noRow.id));
          return f.users.noRow;
        },
      ],
      [
        "the Hub's system account",
        async (f) => {
          const hub = await addUser(f, "pegasus-hub");
          vi.stubEnv("PEGASUS_HUB_USER_ID", hub.id);
          return hub;
        },
      ],
    ];

    it.each(SEES_ALL)(
      "shows %s the restricted columns and lets them move a card into one",
      async (_name, who) => {
        const x = await setup();
        const app = asUser(await who(x.f));

        const seen = await board(x.f, app);
        for (const slug of RESTRICTED) expect(seen.slugs).toContain(slug);
        expect(seen.names).toEqual(expect.arrayContaining(["L1", "L2"]));
        expect((await app.request(`/api/task/${x.f.tasks.L1.id}`)).status).toBe(
          200,
        );

        const moved = await send(
          app,
          "PUT",
          `/task/status/${x.f.tasks.L2.id}`,
          { status: "pegasus-pool" },
        );
        expect(moved.status, await moved.clone().text()).toBe(200);
        expect(await statusOf(x.f.tasks.L2.id)).toBe("pegasus-pool");
      },
    );

    it("hides restricted columns from a Hub member who sees all units but lacks LEAD_READ_INTAKE", async () => {
      const { f } = await setup();

      const seen = await board(f, asUser(f.users.all));

      expect(seen.names).not.toContain("L1");
      expect(seen.names).toContain("L2");
      for (const slug of RESTRICTED) expect(seen.slugs).not.toContain(slug);
    });

    it("does not restrict members of a workspace the Hub does not manage", async () => {
      const { workspace } = await createWorkspaceMember({ role: "owner" });
      const [user] = await db
        .insert(schema.userTable)
        .values({
          id: "user-plain-member",
          email: "plain@example.test",
          emailVerified: true,
          name: "plain",
        })
        .returning();
      await db.insert(schema.workspaceUserTable).values({
        workspaceId: workspace.id,
        userId: user.id,
        role: "member",
        joinedAt: new Date(),
      });
      const { project } = await createProjectFixture({
        workspaceId: workspace.id,
      });
      const pool = await addColumn(project.id, "pegasus-pool", 10, {
        isRestricted: true,
      });
      await db.insert(schema.taskTable).values({
        projectId: project.id,
        title: "Lead",
        status: pool.slug,
        columnId: pool.id,
        number: 1,
      });

      const response = await asUser(user).request(
        `/api/task/tasks/${project.id}`,
      );
      const body = (await response.json()) as {
        data: { columns: Array<{ slug: string; tasks: unknown[] }> };
      };

      expect(
        body.data.columns.find((c) => c.slug === "pegasus-pool")?.tasks,
      ).toHaveLength(1);
    });
  });
});
