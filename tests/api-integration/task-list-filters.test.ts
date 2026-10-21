// Pegasus fork (PEGA-89): server-side board filter by custom field values and
// labels. The board must answer a field filter over 1,000 cards in under two
// seconds and combine it with labels and columns.
import { randomUUID } from "node:crypto";
import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import {
  CARD_FIELDS,
  cardAt,
  type GeneratedCard,
} from "../../apps/api/scripts/seed-cards/generate-cards";
import { insertCards } from "../../apps/api/scripts/seed-cards/insert-cards";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

vi.mock(
  "../../apps/api/src/notification/controllers/create-notification",
  () => ({ default: vi.fn(async () => null) }),
);

const CARD_COUNT = 1000;
const BUDGET_MS = 2000;
const ROLE = "fuehrungskraft";

type App = ReturnType<typeof createApp>["app"];
type BoardPage = {
  data: {
    columns: Array<{
      slug: string;
      tasks: Array<{ id: string; title: string }>;
    }>;
    plannedTasks: Array<{ id: string; title: string }>;
    archivedTasks: Array<{ id: string; title: string }>;
  };
  pagination: { total: number; totalPages: number };
};

function query(params: Record<string, string | object>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    search.set(key, typeof value === "string" ? value : JSON.stringify(value));
  return `?${search.toString()}`;
}

async function listPage(app: App, projectId: string, search: string) {
  const started = performance.now();
  const response = await app.request(`/api/task/tasks/${projectId}${search}`);
  const elapsed = performance.now() - started;
  expect(response.status).toBe(200);
  const body = (await response.json()) as BoardPage;
  const titles = [
    ...body.data.columns.flatMap((column) =>
      column.tasks.map((task) => task.title),
    ),
    ...body.data.plannedTasks.map((task) => task.title),
    ...body.data.archivedTasks.map((task) => task.title),
  ];
  return { body, titles, elapsed };
}

/** Walks every page like the web app does and returns all matching titles. */
async function listAll(
  app: App,
  projectId: string,
  params: Record<string, string | object>,
) {
  const started = performance.now();
  const titles: string[] = [];
  let total = 0;
  for (let page = 1, totalPages = 1; page <= totalPages; page++) {
    const result = await listPage(
      app,
      projectId,
      query({ ...params, page: String(page), limit: "100" }),
    );
    titles.push(...result.titles);
    total = result.body.pagination.total;
    totalPages = result.body.pagination.totalPages;
  }
  return { titles: titles.sort(), total, elapsed: performance.now() - started };
}

function expectedTitles(predicate: (card: GeneratedCard) => boolean) {
  const titles: string[] = [];
  for (let index = 0; index < CARD_COUNT; index++) {
    const card = cardAt(index, 4);
    if (predicate(card)) titles.push(card.title);
  }
  return titles.sort();
}

describe("task list filters by custom field and label", () => {
  let app: App;
  let projectId: string;
  let workspaceId: string;
  let fieldIds: Map<string, string>;
  let adminUser: typeof schema.userTable.$inferSelect;
  let restrictedUser: typeof schema.userTable.$inferSelect;

  beforeAll(async () => {
    await resetTestDatabase();
    const member = await createWorkspaceMember({ role: "admin" });
    workspaceId = member.workspace.id;
    const { project, columns } = await createProjectFixture({ workspaceId });
    projectId = project.id;

    // A restricted member (assigned-only role) owns every tenth card.
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId,
      role: ROLE,
      permission: JSON.stringify({
        task: ["read"],
        project: ["read"],
        workspace: ["read"],
      }),
      assignedOnly: true,
    });
    const restrictedUserId = `user-${randomUUID()}`;
    [restrictedUser] = await db
      .insert(schema.userTable)
      .values({
        id: restrictedUserId,
        email: `${restrictedUserId}@example.com`,
        emailVerified: true,
        name: "Fuehrungskraft",
      })
      .returning();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId,
      userId: restrictedUserId,
      role: ROLE,
      joinedAt: new Date(),
    });

    const orderedColumns = Object.values(columns).sort(
      (left, right) => left.position - right.position,
    );
    const seeded = await insertCards(db, {
      projectId,
      workspaceId,
      columns: orderedColumns,
      count: CARD_COUNT,
      assigneeFor: (index) => (index % 10 === 0 ? restrictedUserId : undefined),
    });
    fieldIds = seeded.fieldIds;
    expect(seeded.cards).toHaveLength(CARD_COUNT);

    adminUser = member.user;
    mockAuthenticatedSession(adminUser);
    app = createApp().app;
  }, 120_000);

  // The setup file restores mocks after every test.
  beforeEach(() => {
    mockAuthenticatedSession(adminUser);
  });

  const paket = () => fieldIds.get("Paket") as string;
  const quelle = () => fieldIds.get("Quelle") as string;
  const plz = () => fieldIds.get("PLZ") as string;

  it("filters 1,000 cards by a dropdown field in under two seconds", async () => {
    const expected = expectedTitles((card) => card.values.Paket === "P2");
    expect(expected.length).toBeGreaterThan(300);

    const firstPage = await listPage(
      app,
      projectId,
      query({ customFields: { [paket()]: ["P2"] }, limit: "100" }),
    );
    expect(firstPage.body.pagination.total).toBe(expected.length);
    expect(firstPage.titles).toHaveLength(100);
    expect(firstPage.elapsed).toBeLessThan(BUDGET_MS);

    const all = await listAll(app, projectId, {
      customFields: { [paket()]: ["P2"] },
    });
    expect(all.titles).toEqual(expected);
    expect(all.elapsed).toBeLessThan(BUDGET_MS);
    process.stdout.write(
      `PEGA-89 timing: first page ${firstPage.elapsed.toFixed(0)} ms, all ${expected.length} matches over ${Math.ceil(expected.length / 100)} pages ${all.elapsed.toFixed(0)} ms\n`,
    );
  });

  it("ORs the values of one field and ANDs several fields", async () => {
    const either = await listAll(app, projectId, {
      customFields: { [paket()]: ["P1", "P3"] },
    });
    expect(either.titles).toEqual(
      expectedTitles((card) => card.values.Paket !== "P2"),
    );

    const both = await listAll(app, projectId, {
      customFields: { [paket()]: ["P2"], [plz()]: ["86004", "86007", "86100"] },
    });
    expect(both.titles).toEqual(["Karte 100", "Karte 4", "Karte 7"]);
  });

  it("matches any selected option of a multiselect field", async () => {
    const result = await listAll(app, projectId, {
      customFields: { [quelle()]: ["Formular"] },
    });
    expect(result.titles).toEqual(
      expectedTitles((card) => card.index % 2 === 1),
    );
    expect(result.total).toBe(CARD_COUNT / 2);
  });

  it("combines a field filter with a label", async () => {
    const result = await listAll(app, projectId, {
      customFields: { [paket()]: ["P2"] },
      labels: ["Kampagne A"],
    });
    expect(result.titles).toEqual(
      expectedTitles((card) => card.values.Paket === "P2" && card.labeled),
    );
    expect(result.elapsed).toBeLessThan(BUDGET_MS);
  });

  it("combines a field filter with a column", async () => {
    const result = await listAll(app, projectId, {
      customFields: { [paket()]: ["P2"] },
      status: "to-do",
    });
    expect(result.titles).toEqual(
      expectedTitles(
        (card) => card.values.Paket === "P2" && card.columnIndex === 0,
      ),
    );
  });

  it("returns nothing for an unknown field or label", async () => {
    const unknownField = await listPage(
      app,
      projectId,
      query({ customFields: { "no-such-field": ["P2"] } }),
    );
    expect(unknownField.body.pagination.total).toBe(0);
    const unknownLabel = await listPage(
      app,
      projectId,
      query({ labels: ["Kampagne Z"] }),
    );
    expect(unknownLabel.body.pagination.total).toBe(0);
  });

  it("rejects malformed filter parameters", async () => {
    const response = await app.request(
      `/api/task/tasks/${projectId}?customFields=${encodeURIComponent("not json")}`,
    );
    expect(response.status).toBe(400);
  });

  it("keeps the assigned-only scope inside the filter", async () => {
    mockAuthenticatedSession(restrictedUser);
    const result = await listAll(app, projectId, {
      customFields: { [paket()]: ["P2"] },
    });
    mockAuthenticatedSession(adminUser);
    expect(result.titles).toEqual(
      expectedTitles(
        (card) => card.values.Paket === "P2" && card.index % 10 === 0,
      ),
    );
  });

  it("documents the fields the fixture provides", () => {
    expect(CARD_FIELDS.map((field) => field.name)).toEqual([
      "Paket",
      "PLZ",
      "Quelle",
    ]);
  });
});
