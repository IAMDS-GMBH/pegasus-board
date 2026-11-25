import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import {
  type App,
  asUser,
  createHubScopeFixture,
  type HubScopeFixture,
  type TaskName,
} from "./helpers/hub-scope-fixture";

// Pegasus fork (PEGA-66): the start page lists every overdue card a
// Führungskraft may see, across the projects of the workspace. Overdue means
// the due date has passed, the column is not final and the card is not
// archived. Tree and unit sets: helpers/hub-scope-fixture.ts.

// Background notifications would race the next test's TRUNCATE.
vi.mock(
  "../../apps/api/src/notification/controllers/create-notification",
  () => ({ default: vi.fn(async () => null) }),
);

beforeEach(resetTestDatabase);

type OverdueTasks = {
  tasks: Array<{
    id: string;
    title: string;
    statusName: string | null;
    dueDate: string;
    assigneeId: string | null;
    assigneeName: string | null;
    projectId: string;
    projectSlug: string;
  }>;
  total: number;
};

const HOUR = 60 * 60 * 1000;
const hoursAgo = (hours: number) => new Date(Date.now() - hours * HOUR);

async function setTask(
  f: HubScopeFixture,
  name: TaskName,
  values: Partial<typeof schema.taskTable.$inferInsert>,
) {
  await db
    .update(schema.taskTable)
    .set(values)
    .where(eq(schema.taskTable.id, f.tasks[name].id));
}

// Overdue: L2 (U3, assigned to the Bearbeiter), L6 (U8), M1 (V3), N0 (no
// unit), oldest first N0, M1, L6, L2. Not overdue although their due date has
// passed or is missing: L1 (future), L3 (none), L4 (final column), L5
// (archived), and a card in an archived project.
async function setup() {
  const f = await createHubScopeFixture();
  await setTask(f, "L1", { dueDate: new Date(Date.now() + 24 * HOUR) });
  await setTask(f, "L2", { dueDate: hoursAgo(1) });
  await setTask(f, "L4", {
    dueDate: hoursAgo(50),
    status: f.columns.done.slug,
    columnId: f.columns.done.id,
  });
  await setTask(f, "L5", {
    dueDate: hoursAgo(50),
    status: "archived",
    columnId: null,
  });
  await setTask(f, "L6", { dueDate: hoursAgo(5) });
  await setTask(f, "M1", { dueDate: hoursAgo(30) });
  await setTask(f, "N0", { dueDate: hoursAgo(72) });

  const old = await createProjectFixture({
    workspaceId: f.workspace.id,
    slug: "old",
  });
  await db
    .update(schema.projectTable)
    .set({ archivedAt: new Date() })
    .where(eq(schema.projectTable.id, old.project.id));
  await db.insert(schema.taskTable).values({
    projectId: old.project.id,
    columnId: old.columns.todo.id,
    title: "Lead im Archiv",
    priority: "medium",
    status: "to-do",
    number: 1,
    position: 1,
    dueDate: hoursAgo(10),
  });
  return f;
}

async function overdue(f: HubScopeFixture, app: App, countOnly?: boolean) {
  const query = countOnly ? "&countOnly=true" : "";
  const response = await app.request(
    `/api/task/overdue?workspaceId=${f.workspace.id}${query}`,
  );
  expect(response.status, await response.clone().text()).toBe(200);
  return (await response.json()) as OverdueTasks;
}

describe("overdue tasks API", () => {
  it("lists an unrestricted member's overdue cards, oldest first", async () => {
    const f = await setup();

    const body = await overdue(f, asUser(f.owner));

    expect(body.total).toBe(4);
    expect(body.tasks.map((task) => task.title)).toEqual([
      "Lead N0",
      "Lead M1",
      "Lead L6",
      "Lead L2",
    ]);
    expect(body.tasks.at(-1)).toMatchObject({
      id: f.tasks.L2.id,
      statusName: "To Do",
      assigneeId: f.users.bearbeiter.id,
      assigneeName: "bearbeiter@wwk.test",
      projectId: f.project.id,
      projectSlug: "bew",
    });
  });

  it.each([
    ["fkBD", ["L2"]],
    ["fkFD", ["L2"]],
    ["multi", ["L2", "L6"]],
    ["all", ["L2", "L6", "M1", "N0"]],
    ["bearbeiter", ["L2"]],
    ["noRow", []],
  ] as const)(
    "shows %s exactly the overdue cards %j of their scope",
    async (user, expected) => {
      const f = await setup();

      const body = await overdue(f, asUser(f.users[user]));

      expect(f.namesOf(body.tasks.map((task) => task.id))).toEqual([
        ...expected,
      ]);
      expect(body.total).toBe(expected.length);
    },
  );

  it("counts without listing", async () => {
    const f = await setup();

    expect(await overdue(f, asUser(f.users.multi), true)).toEqual({
      tasks: [],
      total: 2,
    });
  });

  it("refuses a workspace the caller does not belong to", async () => {
    const f = await setup();
    const outsider = await createWorkspaceMember();

    const response = await asUser(outsider.user).request(
      `/api/task/overdue?workspaceId=${f.workspace.id}`,
    );

    expect(response.status).toBe(404);
  });
});
