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
} from "./helpers/hub-scope-fixture";

// Pegasus fork (PEGA-80): in a workspace the Hub manages, only members it does
// not govern (owners, instance admins, the Hub's system account) may manage
// project integrations, above all the Generic Webhook the Hub registers in
// every project. Workspaces without a Hub push keep Kaneo's rules.

vi.mock(
  "../../apps/api/src/notification/controllers/create-notification",
  () => ({ default: vi.fn(async () => null) }),
);

const WEBHOOK = "/generic-webhook-integration/project";
const webhookBody = { webhookUrl: "http://127.0.0.1:9/hub", secret: "s3cret" };

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

async function makeAdmin(userId: string) {
  await db
    .update(schema.workspaceUserTable)
    .set({ role: "admin" })
    .where(eq(schema.workspaceUserTable.userId, userId));
}

async function seedGitea(projectId: string) {
  await db.insert(schema.integrationTable).values({
    projectId,
    type: "gitea",
    config: JSON.stringify({
      baseUrl: "https://git.example",
      accessToken: "token",
      repositoryOwner: "team",
      repositoryName: "repo",
      webhookSecret: "gitea-webhook-secret",
    }),
  });
}

type Route = (f: HubScopeFixture, app: App) => Promise<Response>;

// Each one as a governed workspace admin would use it to change or read the
// project's integrations.
const ROUTES: Array<[string, Route]> = [
  [
    "getGenericWebhookIntegration",
    (f, app) => send(app, "GET", `${WEBHOOK}/${f.project.id}`),
  ],
  [
    "createGenericWebhookIntegration",
    (f, app) => send(app, "POST", `${WEBHOOK}/${f.project.id}`, webhookBody),
  ],
  [
    "updateGenericWebhookIntegration",
    (f, app) =>
      send(app, "PATCH", `${WEBHOOK}/${f.project.id}`, { isActive: false }),
  ],
  [
    "deleteGenericWebhookIntegration",
    (f, app) => send(app, "DELETE", `${WEBHOOK}/${f.project.id}`),
  ],
  [
    "createSlackIntegration",
    (f, app) =>
      send(app, "POST", `/slack-integration/project/${f.project.id}`, {
        webhookUrl: "https://hooks.slack.com/services/x/y/z",
      }),
  ],
  [
    "deleteSlackIntegration",
    (f, app) =>
      send(app, "DELETE", `/slack-integration/project/${f.project.id}`),
  ],
  [
    "createGiteaIntegration",
    (f, app) =>
      send(app, "POST", `/gitea-integration/project/${f.project.id}`, {
        baseUrl: "https://git.example",
        accessToken: "token",
        repositoryOwner: "team",
        repositoryName: "repo",
      }),
  ],
  [
    "deleteGiteaIntegration",
    (f, app) =>
      send(app, "DELETE", `/gitea-integration/project/${f.project.id}`),
  ],
  [
    "previewIntegrationSyncRules",
    (f, app) =>
      send(
        app,
        "POST",
        `/integration-sync/project/${f.project.id}/gitea/preview`,
        {
          outgoing: { mode: "all" },
          incoming: { mode: "all" },
        },
      ),
  ],
];

describe("API integration: who may manage integrations in a Hub workspace", () => {
  beforeEach(async () => {
    vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "true");
    await resetTestDatabase();
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each(ROUTES)(
    "refuses %s to a governed workspace admin",
    async (_name, route) => {
      const f = await createHubScopeFixture();
      await seedGitea(f.project.id);
      await makeAdmin(f.users.all.id);

      const response = await route(f, asUser(f.users.all));

      expect(response.status).toBe(403);
      expect(await readErrorBody(response)).toMatchObject({
        code: "HUB_GOVERNED",
      });
    },
  );

  it("keeps the Hub's webhook when a governed admin tries to remove it", async () => {
    const f = await createHubScopeFixture();
    await send(
      asUser(f.owner),
      "POST",
      `${WEBHOOK}/${f.project.id}`,
      webhookBody,
    );
    await makeAdmin(f.users.all.id);

    await send(asUser(f.users.all), "DELETE", `${WEBHOOK}/${f.project.id}`);

    const rows = await db
      .select()
      .from(schema.integrationTable)
      .where(eq(schema.integrationTable.projectId, f.project.id));
    expect(rows.map((row) => row.type)).toEqual(["generic-webhook"]);
  });

  it("shows a governed admin the code-hosting link without its webhook secret", async () => {
    const f = await createHubScopeFixture();
    await seedGitea(f.project.id);
    await makeAdmin(f.users.all.id);

    const response = await send(
      asUser(f.users.all),
      "GET",
      `/gitea-integration/project/${f.project.id}`,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ repositoryOwner: "team" });
    // Kaneo sends a withheld secret as "".
    expect(body.webhookSecret).toBe("");
  });

  it("lets the Hub's system account create, read, replace and update the webhook with its API key", async () => {
    const f = await createHubScopeFixture();
    const hub = f.users.noRow;
    await makeAdmin(hub.id);
    vi.stubEnv("PEGASUS_HUB_USER_ID", hub.id);
    const key = `hub-integrations-${hub.id}`.padEnd(64, "x");
    await db.insert(schema.apikeyTable).values({
      referenceId: hub.id,
      userId: hub.id,
      key: createHash("sha256").update(key).digest("base64url"),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const app = createApp().app;
    const asHub = (method: string, body?: unknown) =>
      send(app, method, `${WEBHOOK}/${f.project.id}`, body, {
        "x-api-key": key,
      });

    const created = await asHub("POST", webhookBody);
    expect(created.status, await created.clone().text()).toBe(200);
    const read = await asHub("GET");
    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({ webhookConfigured: true });
    // POST upserts: the Hub replaces its webhook by posting it again.
    const replaced = await asHub("POST", {
      webhookUrl: "http://127.0.0.1:9/hub-v2",
      secret: "rotated",
    });
    expect(replaced.status, await replaced.clone().text()).toBe(200);
    expect(await replaced.json()).toMatchObject({
      maskedWebhookUrl: "http…b-v2",
    });
    const updated = await asHub("PATCH", { isActive: true });
    expect(updated.status, await updated.clone().text()).toBe(200);
  });

  it.each([
    ["the owner", async (f: HubScopeFixture) => f.owner],
    [
      "an instance admin",
      async (f: HubScopeFixture) => {
        const [user] = await db
          .update(schema.userTable)
          .set({ role: "admin" })
          .where(eq(schema.userTable.id, f.users.all.id))
          .returning();
        return user;
      },
    ],
  ])("lets %s manage the webhook", async (_name, pick) => {
    const f = await createHubScopeFixture();
    const app = asUser(await pick(f));

    const created = await send(
      app,
      "POST",
      `${WEBHOOK}/${f.project.id}`,
      webhookBody,
    );
    expect(created.status, await created.clone().text()).toBe(200);
    expect((await send(app, "GET", `${WEBHOOK}/${f.project.id}`)).status).toBe(
      200,
    );
  });

  it("keeps Kaneo's rules in a workspace the Hub does not manage", async () => {
    const admin = await createWorkspaceMember({ role: "admin" });
    const member = await createWorkspaceMember({ role: "member" });
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: admin.workspace.id,
      userId: member.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    const { project } = await createProjectFixture({
      workspaceId: admin.workspace.id,
    });
    const path = `${WEBHOOK}/${project.id}`;

    const created = await send(asUser(admin.user), "POST", path, webhookBody);
    expect(created.status, await created.clone().text()).toBe(200);
    expect((await send(asUser(admin.user), "GET", path)).status).toBe(200);

    const denied = await send(asUser(member.user), "POST", path, webhookBody);
    expect(denied.status).toBe(403);
    expect(await readErrorBody(denied)).not.toMatchObject({
      code: "HUB_GOVERNED",
    });
    expect((await send(asUser(member.user), "GET", path)).status).toBe(200);
  });
});
