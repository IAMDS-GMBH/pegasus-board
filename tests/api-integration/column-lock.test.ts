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
} from "./helpers/hub-scope-fixture";

// Pegasus fork (PEGA-170): Eingang and Pegasus-Pool are technical columns.
// Members may not move cards into or out of them; owners, instance admins and
// the Hub's system account may. Fields of the cards stay editable.

// Background notifications would race the next test's TRUNCATE.
vi.mock(
  "../../apps/api/src/notification/controllers/create-notification",
  () => ({ default: vi.fn(async () => null) }),
);

beforeEach(resetTestDatabase);
afterEach(() => vi.unstubAllEnvs());

function send(app: App, method: string, path: string, body?: unknown) {
  return app.request(`/api${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function addColumn(
  projectId: string,
  name: string,
  slug: string,
  position: number,
  isLocked = false,
) {
  const [column] = await db
    .insert(schema.columnTable)
    .values({ projectId, name, slug, position, isLocked })
    .returning();
  return column;
}

async function putInColumn(
  taskId: string,
  column: typeof schema.columnTable.$inferSelect,
) {
  await db
    .update(schema.taskTable)
    .set({ status: column.slug, columnId: column.id })
    .where(eq(schema.taskTable.id, taskId));
}

// L1 sits in Eingang, L2 in Unbearbeitet; fkBD holds every lead right,
// LEAD_MOVE_STAGE included. The other project has its own locked Eingang.
async function setup() {
  const f = await createHubScopeFixture();
  const eingang = await addColumn(f.project.id, "Eingang", "eingang", 10, true);
  await addColumn(f.project.id, "Pegasus-Pool", "pegasus-pool", 11, true);
  const unbearbeitet = await addColumn(
    f.project.id,
    "Unbearbeitet",
    "unbearbeitet",
    12,
  );
  await putInColumn(f.tasks.L1.id, eingang);
  await putInColumn(f.tasks.L2.id, unbearbeitet);
  const other = await createProjectFixture({
    workspaceId: f.workspace.id,
    slug: "other",
  });
  await addColumn(other.project.id, "Eingang", "eingang", 10, true);
  return { f, other };
}

type Fixture = Awaited<ReturnType<typeof setup>>;
type Move = (x: Fixture, app: App) => Promise<Response>;

const statusOf = async (taskId: string) =>
  (
    await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, taskId),
    })
  )?.status;

const fullUpdate = (x: Fixture, status: string) => ({
  title: "Lead",
  priority: "medium",
  status,
  projectId: x.f.project.id,
  position: 1,
});

// [path, column the message names, request]
const DENIED: Array<[string, string, Move]> = [
  [
    "updateTaskStatus out of Eingang",
    "Eingang",
    (x, app) =>
      send(app, "PUT", `/task/status/${x.f.tasks.L1.id}`, {
        status: "unbearbeitet",
      }),
  ],
  [
    "updateTaskStatus into Pegasus-Pool",
    "Pegasus-Pool",
    (x, app) =>
      send(app, "PUT", `/task/status/${x.f.tasks.L2.id}`, {
        status: "pegasus-pool",
      }),
  ],
  [
    "updateTask out of Eingang",
    "Eingang",
    (x, app) =>
      send(
        app,
        "PUT",
        `/task/${x.f.tasks.L1.id}`,
        fullUpdate(x, "unbearbeitet"),
      ),
  ],
  [
    "updateTask into Pegasus-Pool",
    "Pegasus-Pool",
    (x, app) =>
      send(
        app,
        "PUT",
        `/task/${x.f.tasks.L2.id}`,
        fullUpdate(x, "pegasus-pool"),
      ),
  ],
  [
    "reorderTasks out of Eingang",
    "Eingang",
    (x, app) =>
      send(app, "POST", "/task/reorder", {
        projectId: x.f.project.id,
        tasks: [{ id: x.f.tasks.L1.id, position: 1, status: "unbearbeitet" }],
      }),
  ],
  [
    "reorderTasks into Pegasus-Pool",
    "Pegasus-Pool",
    (x, app) =>
      send(app, "POST", "/task/reorder", {
        projectId: x.f.project.id,
        tasks: [{ id: x.f.tasks.L2.id, position: 1, status: "pegasus-pool" }],
      }),
  ],
  [
    "bulk updateStatus out of Eingang",
    "Eingang",
    (x, app) =>
      send(app, "PATCH", "/task/bulk", {
        taskIds: [x.f.tasks.L2.id, x.f.tasks.L1.id],
        operation: "updateStatus",
        value: "unbearbeitet",
      }),
  ],
  [
    "bulk updateStatus into Pegasus-Pool",
    "Pegasus-Pool",
    (x, app) =>
      send(app, "PATCH", "/task/bulk", {
        taskIds: [x.f.tasks.L2.id],
        operation: "updateStatus",
        value: "pegasus-pool",
      }),
  ],
  [
    "moveTask out of Eingang",
    "Eingang",
    (x, app) =>
      send(app, "PUT", `/task/move/${x.f.tasks.L1.id}`, {
        destinationProjectId: x.other.project.id,
        destinationStatus: "to-do",
      }),
  ],
  [
    "moveTask into another project's Eingang",
    "Eingang",
    (x, app) =>
      send(app, "PUT", `/task/move/${x.f.tasks.L2.id}`, {
        destinationProjectId: x.other.project.id,
        destinationStatus: "eingang",
      }),
  ],
  [
    "createTask in Pegasus-Pool",
    "Pegasus-Pool",
    (x, app) =>
      send(app, "POST", `/task/${x.f.project.id}`, {
        title: "Neu",
        description: "",
        priority: "medium",
        status: "pegasus-pool",
      }),
  ],
  [
    "importTasks into Eingang",
    "Eingang",
    (x, app) =>
      send(app, "POST", `/task/import/${x.f.project.id}`, {
        tasks: [{ title: "Neu", status: "eingang" }],
      }),
  ],
  [
    "duplicateTask in Eingang",
    "Eingang",
    (x, app) => send(app, "POST", `/task/duplicate/${x.f.tasks.L1.id}`, {}),
  ],
];

describe("locked columns", () => {
  it.each(DENIED)(
    "denies %s to a member with LEAD_MOVE_STAGE",
    async (_name, column, move) => {
      const x = await setup();

      const response = await move(x, asUser(x.f.users.fkBD));

      expect(response.status).toBe(403);
      const body = await readErrorBody(response);
      expect(body).toMatchObject({ code: "COLUMN_LOCKED" });
      expect(body.message).toContain(`„${column}“`);
      expect(await statusOf(x.f.tasks.L1.id)).toBe("eingang");
      expect(await statusOf(x.f.tasks.L2.id)).toBe("unbearbeitet");
    },
  );

  it("lets the same member edit title, description, a field and the assignee of a card in Eingang", async () => {
    const x = await setup();
    const [field] = await db
      .insert(schema.customFieldDefinitionTable)
      .values({ projectId: x.f.project.id, name: "Ort", type: "text" })
      .returning();
    const app = asUser(x.f.users.fkBD);
    const L1 = x.f.tasks.L1.id;

    const responses = [
      await send(app, "PUT", `/task/title/${L1}`, { title: "Neu" }),
      await send(app, "PUT", `/task/description/${L1}`, {
        description: "Rückruf",
      }),
      await send(app, "PUT", "/custom-field/value", {
        taskId: L1,
        fieldId: field.id,
        value: "Augsburg",
      }),
      await send(app, "PUT", `/task/assignee/${L1}`, {
        userId: x.f.users.fkBD.id,
      }),
      await send(app, "PUT", `/task/${L1}`, {
        ...fullUpdate(x, "eingang"),
        title: "Neu 2",
      }),
    ];

    expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    expect(await statusOf(L1)).toBe("eingang");
  });

  it("lets the same member comment on and label a card in Eingang", async () => {
    const x = await setup();
    const [label] = await db
      .insert(schema.labelTable)
      .values({
        name: "Paket 1",
        color: "orange",
        workspaceId: x.f.workspace.id,
      })
      .returning();
    const app = asUser(x.f.users.fkBD);
    const L1 = x.f.tasks.L1.id;

    const comment = await send(app, "POST", `/comment/${L1}`, {
      content: "Rückruf",
    });
    const labelled = await send(app, "PUT", `/label/${label.id}/task`, {
      taskId: L1,
    });

    expect(comment.status, await comment.clone().text()).toBe(200);
    expect(labelled.status, await labelled.clone().text()).toBe(200);
    expect(await statusOf(L1)).toBe("eingang");
  });

  it("refuses an import as a whole when one card targets a locked column", async () => {
    const x = await setup();
    const before = await db.$count(
      schema.taskTable,
      eq(schema.taskTable.projectId, x.f.project.id),
    );

    const response = await send(
      asUser(x.f.users.fkBD),
      "POST",
      `/task/import/${x.f.project.id}`,
      {
        tasks: [
          { title: "Erlaubt", status: "unbearbeitet" },
          { title: "Gesperrt", status: "eingang" },
        ],
      },
    );

    expect(response.status).toBe(403);
    expect(await readErrorBody(response)).toMatchObject({
      code: "COLUMN_LOCKED",
    });
    expect(
      await db.$count(
        schema.taskTable,
        eq(schema.taskTable.projectId, x.f.project.id),
      ),
    ).toBe(before);
  });

  it("lets a member reorder within a locked column", async () => {
    const x = await setup();

    const response = await send(
      asUser(x.f.users.fkBD),
      "POST",
      "/task/reorder",
      {
        projectId: x.f.project.id,
        tasks: [{ id: x.f.tasks.L1.id, position: 7, status: "eingang" }],
      },
    );

    expect(response.status).toBe(200);
  });

  it("treats archiving and deleting a card in Eingang as no move", async () => {
    const x = await setup();
    const app = asUser(x.f.users.fkBD);

    const archived = await send(app, "PUT", `/task/status/${x.f.tasks.L1.id}`, {
      status: "archived",
    });
    await putInColumn(
      x.f.tasks.L1.id,
      (await db.query.columnTable.findFirst({
        where: eq(schema.columnTable.slug, "eingang"),
      }))!,
    );
    const deleted = await send(app, "DELETE", `/task/${x.f.tasks.L1.id}`);

    expect(archived.status).toBe(200);
    expect(deleted.status).toBe(200);
  });

  it.each(["member", "admin"])(
    "locks a %s of a workspace the Hub does not manage too",
    async (role) => {
      vi.stubEnv("PEGASUS_HUB_USER_ID", "user-the-real-hub");
      const { workspace } = await createWorkspaceMember({ role: "owner" });
      const [user] = await db
        .insert(schema.userTable)
        .values({
          id: `user-${role}`,
          email: `${role}@example.test`,
          emailVerified: true,
          name: role,
        })
        .returning();
      await db.insert(schema.workspaceUserTable).values({
        workspaceId: workspace.id,
        userId: user.id,
        role,
        joinedAt: new Date(),
      });
      const { project } = await createProjectFixture({
        workspaceId: workspace.id,
      });
      const eingang = await addColumn(
        project.id,
        "Eingang",
        "eingang",
        10,
        true,
      );
      const [task] = await db
        .insert(schema.taskTable)
        .values({
          projectId: project.id,
          title: "Lead",
          status: eingang.slug,
          columnId: eingang.id,
          number: 1,
        })
        .returning();

      const response = await send(
        asUser(user),
        "PUT",
        `/task/status/${task.id}`,
        { status: "to-do" },
      );

      expect(response.status).toBe(403);
      expect(await readErrorBody(response)).toMatchObject({
        code: "COLUMN_LOCKED",
      });
    },
  );

  describe("who is exempt", () => {
    async function addAdmin(f: HubScopeFixture, id: string) {
      const [user] = await db
        .insert(schema.userTable)
        .values({ id, email: `${id}@wwk.test`, emailVerified: true, name: id })
        .returning();
      await db.insert(schema.workspaceUserTable).values({
        workspaceId: f.workspace.id,
        userId: user.id,
        role: "admin",
        joinedAt: new Date(),
      });
      return user;
    }

    const EXEMPT: Array<
      [string, (f: HubScopeFixture) => Promise<HubScopeFixture["owner"]>]
    > = [
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
          const hub = await addAdmin(f, "pegasus-hub");
          vi.stubEnv("PEGASUS_HUB_USER_ID", hub.id);
          return hub;
        },
      ],
    ];

    it.each(EXEMPT)(
      "lets %s move a card from Eingang to Unbearbeitet",
      async (_name, who) => {
        const x = await setup();
        const app = asUser(await who(x.f));

        const response = await send(
          app,
          "PUT",
          `/task/status/${x.f.tasks.L1.id}`,
          { status: "unbearbeitet" },
        );

        expect(response.status).toBe(200);
        expect(await statusOf(x.f.tasks.L1.id)).toBe("unbearbeitet");
      },
    );
  });
});
