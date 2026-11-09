import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import { readErrorBody } from "./helpers/error-body";
import {
  type App,
  asUser,
  createHubScopeFixture,
  type HubScopeFixture,
} from "./helpers/hub-scope-fixture";

// Pegasus fork (PEGA-142): lead writes that hide in a route's body or in a
// side route still need the Hub's right: an assignee on a new lead, a label
// created onto a lead, issue imports and resuming an integration sync.

vi.mock(
  "../../apps/api/src/notification/controllers/create-notification",
  () => ({ default: vi.fn(async () => null) }),
);

const provider = vi.hoisted(() => ({
  listIssues: vi.fn(async () => []),
  listPulls: vi.fn(async () => []),
}));
vi.mock(
  "../../apps/api/src/plugins/gitea/utils/gitea-api",
  async (original) => ({
    ...(await original<
      typeof import("../../apps/api/src/plugins/gitea/utils/gitea-api")
    >()),
    createGiteaClient: () => provider,
  }),
);

const FK_BD = "fk-bd@wwk.test";

function send(app: App, method: string, path: string, body?: unknown) {
  return app.request(`/api${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function setRole(userId: string, role: string) {
  await db
    .update(schema.workspaceUserTable)
    .set({ role })
    .where(eq(schema.workspaceUserTable.userId, userId));
}

async function expectMissing(response: Response, missing: string[]) {
  expect(response.status).toBe(403);
  expect(await readErrorBody(response)).toMatchObject({
    code: "MISSING_PERMISSION",
    missingPermissions: missing,
  });
}

const newLead = (f: HubScopeFixture, userId?: string) =>
  send(asUser(f.users.fkBD), "POST", `/task/${f.project.id}`, {
    title: "Neu",
    description: "",
    priority: "medium",
    status: "to-do",
    ...(userId === undefined ? {} : { userId }),
  });

const importLead = (f: HubScopeFixture, userId?: string | null) =>
  send(asUser(f.users.fkBD), "POST", `/task/import/${f.project.id}`, {
    tasks: [
      {
        title: "Neu",
        status: "to-do",
        ...(userId === undefined ? {} : { userId }),
      },
    ],
  });

describe("API integration: Hub rights on side routes", () => {
  beforeEach(() => resetTestDatabase());

  describe("an assignee on a new lead", () => {
    it.each([
      ["createTask", newLead],
      ["importTasks", importLead],
    ] as const)("%s needs LEAD_ASSIGN_PROCESSOR", async (_name, create) => {
      const f = await createHubScopeFixture();
      await f.pushPermissions(FK_BD, ["LEAD_READ", "LEAD_CREATE"]);

      await expectMissing(await create(f, f.users.fkBD.id), [
        "LEAD_ASSIGN_PROCESSOR",
      ]);

      await f.pushPermissions(FK_BD, [
        "LEAD_READ",
        "LEAD_CREATE",
        "LEAD_ASSIGN_PROCESSOR",
      ]);
      const allowed = await create(f, f.users.fkBD.id);
      expect(allowed.status, await allowed.clone().text()).toBe(200);
    });

    it.each([
      ["createTask without userId", (f: HubScopeFixture) => newLead(f)],
      [
        "createTask with an empty userId",
        (f: HubScopeFixture) => newLead(f, ""),
      ],
      [
        "importTasks with userId null",
        (f: HubScopeFixture) => importLead(f, null),
      ],
    ])("%s needs only LEAD_CREATE", async (_name, create) => {
      const f = await createHubScopeFixture();
      await f.pushPermissions(FK_BD, ["LEAD_READ", "LEAD_CREATE"]);

      const response = await create(f);
      expect(response.status, await response.clone().text()).toBe(200);
    });
  });

  describe("a label created onto a lead", () => {
    const createLabel = (f: HubScopeFixture, taskId?: string) =>
      send(asUser(f.users.fkBD), "POST", "/label", {
        name: "Paket 3",
        color: "orange",
        workspaceId: f.workspace.id,
        ...(taskId ? { taskId } : {}),
      });

    it("needs LEAD_EDIT next to the role's label:create", async () => {
      const f = await createHubScopeFixture();
      await setRole(f.users.fkBD.id, "admin");
      await f.pushPermissions(FK_BD, ["LEAD_READ"]);

      await expectMissing(await createLabel(f, f.tasks.L1.id), ["LEAD_EDIT"]);

      await f.pushPermissions(FK_BD, ["LEAD_READ", "LEAD_EDIT"]);
      expect((await createLabel(f, f.tasks.L1.id)).status).toBe(200);
    });

    it("stays with the role for a label without a lead", async () => {
      const f = await createHubScopeFixture();
      await setRole(f.users.fkBD.id, "admin");
      await f.pushPermissions(FK_BD, ["LEAD_READ"]);

      expect((await createLabel(f)).status).toBe(200);
    });
  });

  describe("issue imports", () => {
    it.each(["github", "gitea", "gitlab"])(
      "%s needs LEAD_CREATE and LEAD_EDIT, whatever the role",
      async (type) => {
        const f = await createHubScopeFixture();
        await setRole(f.users.fkBD.id, "admin");
        const importIssues = () =>
          send(
            asUser(f.users.fkBD),
            "POST",
            `/${type}-integration/import-issues`,
            {
              projectId: f.project.id,
            },
          );

        await f.pushPermissions(FK_BD, ["LEAD_READ"]);
        await expectMissing(await importIssues(), ["LEAD_CREATE", "LEAD_EDIT"]);

        await f.pushPermissions(FK_BD, ["LEAD_READ", "LEAD_CREATE"]);
        await expectMissing(await importIssues(), ["LEAD_EDIT"]);

        // Past the rights check, the import fails on the missing integration.
        await f.pushPermissions(FK_BD, [
          "LEAD_READ",
          "LEAD_CREATE",
          "LEAD_EDIT",
        ]);
        expect((await importIssues()).status).not.toBe(403);
      },
    );
  });

  describe("resuming an integration sync", () => {
    it("needs LEAD_EDIT, whatever the role", async () => {
      const f = await createHubScopeFixture();
      // Mode `all`: the sync's restricted-visibility guard lets them through.
      await setRole(f.users.all.id, "admin");
      await f.pushPermissions("all@wwk.test", ["LEAD_READ"]);

      const response = await send(
        asUser(f.users.all),
        "POST",
        `/integration-sync/project/${f.project.id}/github/links/link-1/resume`,
        { token: "t".repeat(64), source: "kaneo" },
      );

      await expectMissing(response, ["LEAD_EDIT"]);
    });
  });
});
