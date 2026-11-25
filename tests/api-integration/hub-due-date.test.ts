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
  type App,
  asUser,
  createHubScopeFixture,
  type HubScopeFixture,
  LEAD_RIGHTS,
} from "./helpers/hub-scope-fixture";

// Pegasus fork (PEGA-66): the Hub runs the 48-hour deadline of a lead in
// "Unbearbeitet" by setting and clearing the card's due date with the API key
// of its system account. Neither a column lock nor a Hub right may stop it.

// Background notifications would race the next test's TRUNCATE.
vi.mock(
  "../../apps/api/src/notification/controllers/create-notification",
  () => ({ default: vi.fn(async () => null) }),
);

beforeEach(resetTestDatabase);
afterEach(() => vi.unstubAllEnvs());

const DEADLINE = "2026-11-27T14:30:00.000Z";

async function addHubAccount(f: HubScopeFixture) {
  const [hub] = await db
    .insert(schema.userTable)
    .values({
      id: "pegasus-hub",
      email: "hub@wwk.test",
      emailVerified: true,
      name: "Hub",
    })
    .returning();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId: f.workspace.id,
    userId: hub.id,
    role: "admin",
    joinedAt: new Date(),
  });
  vi.stubEnv("PEGASUS_HUB_USER_ID", hub.id);
  const key = `hub-due-date-${hub.id}`.padEnd(64, "x");
  await db.insert(schema.apikeyTable).values({
    referenceId: hub.id,
    userId: hub.id,
    key: createHash("sha256").update(key).digest("base64url"),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const app = createApp().app;
  return (method: string, path: string, body?: unknown) =>
    send(app, method, path, body, { "x-api-key": key });
}

function send(
  app: App,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  return app.request(`/api${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function lockColumnOf(f: HubScopeFixture, taskId: string) {
  const [eingang] = await db
    .insert(schema.columnTable)
    .values({
      projectId: f.project.id,
      name: "Eingang",
      slug: "eingang",
      position: 10,
      isLocked: true,
    })
    .returning();
  await db
    .update(schema.taskTable)
    .set({ status: eingang.slug, columnId: eingang.id })
    .where(eq(schema.taskTable.id, taskId));
}

async function dueDateOf(
  asHub: Awaited<ReturnType<typeof addHubAccount>>,
  taskId: string,
) {
  const response = await asHub("GET", `/task/${taskId}`);
  expect(response.status).toBe(200);
  return ((await response.json()) as { dueDate: string | null }).dueDate;
}

describe("the Hub's deadline on a card", () => {
  it("lets the system account set and clear the due date of a card in a locked column", async () => {
    const f = await createHubScopeFixture();
    await lockColumnOf(f, f.tasks.L1.id);
    const asHub = await addHubAccount(f);

    const set = await asHub("PUT", `/task/due-date/${f.tasks.L1.id}`, {
      dueDate: DEADLINE,
    });
    expect(set.status, await set.clone().text()).toBe(200);
    expect(await set.json()).toMatchObject({ dueDate: DEADLINE });
    expect(await dueDateOf(asHub, f.tasks.L1.id)).toBe(DEADLINE);

    const cleared = await asHub("PUT", `/task/due-date/${f.tasks.L1.id}`, {});
    expect(cleared.status, await cleared.clone().text()).toBe(200);
    expect(await cleared.json()).toMatchObject({ dueDate: null });
    expect(await dueDateOf(asHub, f.tasks.L1.id)).toBeNull();
  });

  it("lets the system account set and clear a due date a Führungskraft without LEAD_EDIT may not change", async () => {
    const f = await createHubScopeFixture();
    await f.pushPermissions(
      "fk-bd@wwk.test",
      LEAD_RIGHTS.filter((right) => right !== "LEAD_EDIT"),
    );
    const asHub = await addHubAccount(f);

    const set = await asHub("PUT", `/task/due-date/${f.tasks.L1.id}`, {
      dueDate: DEADLINE,
    });
    expect(set.status, await set.clone().text()).toBe(200);
    const cleared = await asHub("PUT", `/task/due-date/${f.tasks.L1.id}`, {});
    expect(cleared.status, await cleared.clone().text()).toBe(200);

    const denied = await send(
      asUser(f.users.fkBD),
      "PUT",
      `/task/due-date/${f.tasks.L1.id}`,
      { dueDate: DEADLINE },
    );
    expect(denied.status).toBe(403);
    expect(await readErrorBody(denied)).toMatchObject({
      code: "MISSING_PERMISSION",
      missingPermissions: ["LEAD_EDIT"],
    });
  });
});
