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
import { createWorkspaceMember } from "./helpers/fixtures";
import {
  type App,
  asUser,
  createHubScopeFixture,
  type HubScopeFixture,
  LEAD_RIGHTS,
} from "./helpers/hub-scope-fixture";

// Pegasus fork (PEGA-142): a member the Hub governs must not rewrite the
// snapshot that governs them, even as a workspace admin. Only owners,
// instance admins and the Hub's system account (PEGASUS_HUB_USER_ID) may.

vi.mock(
  "../../apps/api/src/notification/controllers/create-notification",
  () => ({ default: vi.fn(async () => null) }),
);

function send(app: App, method: string, path: string, body?: unknown) {
  return app.request(`/api/pegasus-visibility${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// Every push route, as the governed admin would use it to lift themselves.
const ROUTES: Array<
  [string, (f: HubScopeFixture, app: App) => Promise<Response>]
> = [
  [
    "replacePegasusUserScopes",
    (f, app) =>
      send(app, "PUT", `/workspace/${f.workspace.id}/users`, {
        users: [
          {
            email: "fk-bd@wwk.test",
            mode: "all",
            unitIds: [],
            permissions: LEAD_RIGHTS,
          },
        ],
      }),
  ],
  [
    "getPegasusUserScopes",
    (f, app) => send(app, "GET", `/workspace/${f.workspace.id}/users`),
  ],
  [
    "setPegasusTaskUnit",
    (f, app) =>
      send(app, "PUT", `/task/${f.tasks.L1.id}/unit`, { unitId: "U6" }),
  ],
  [
    "setPegasusTaskUnits",
    (f, app) =>
      send(app, "PUT", `/workspace/${f.workspace.id}/tasks`, {
        tasks: [{ taskId: f.tasks.L1.id, unitId: "U6" }],
      }),
  ],
];

async function makeAdmin(userId: string) {
  await db
    .update(schema.workspaceUserTable)
    .set({ role: "admin" })
    .where(eq(schema.workspaceUserTable.userId, userId));
}

describe("API integration: who may use the Hub's push API", () => {
  beforeEach(() => resetTestDatabase());
  afterEach(() => vi.unstubAllEnvs());

  it.each(ROUTES)(
    "refuses %s to a governed workspace admin",
    async (_name, route) => {
      const f = await createHubScopeFixture();
      await makeAdmin(f.users.fkBD.id);

      const response = await route(f, asUser(f.users.fkBD));

      expect(response.status).toBe(403);
      expect(await readErrorBody(response)).toMatchObject({
        code: "HUB_GOVERNED",
      });
    },
  );

  it("keeps the governed admin's snapshot as the Hub pushed it", async () => {
    const f = await createHubScopeFixture();
    await makeAdmin(f.users.fkBD.id);

    await ROUTES[0][1](f, asUser(f.users.fkBD));

    const [row] = await db
      .select({ mode: schema.pegasusUserScopeTable.mode })
      .from(schema.pegasusUserScopeTable)
      .where(eq(schema.pegasusUserScopeTable.email, "fk-bd@wwk.test"));
    expect(row?.mode).toBe("units");
  });

  it.each(ROUTES)(
    "lets the Hub's system account use %s",
    async (_name, route) => {
      const f = await createHubScopeFixture();
      await makeAdmin(f.users.noRow.id);
      vi.stubEnv("PEGASUS_HUB_USER_ID", f.users.noRow.id);

      const response = await route(f, asUser(f.users.noRow));

      expect(response.status, await response.clone().text()).toBe(200);
    },
  );

  it("lets a workspace admin hand an unmanaged workspace to the Hub", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });

    const response = await send(
      asUser(admin.user),
      "PUT",
      `/workspace/${admin.workspace.id}/users`,
      { users: [] },
    );

    expect(response.status).toBe(200);
  });
});
