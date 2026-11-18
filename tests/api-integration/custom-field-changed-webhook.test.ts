import { randomUUID } from "node:crypto";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { postToGenericWebhook } from "../../apps/api/src/plugins/generic-webhook/client";
import { genericWebhookPlugin } from "../../apps/api/src/plugins/generic-webhook";
import {
  initializeEventSubscriptions,
  registerPlugin,
} from "../../apps/api/src/plugins/registry";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

// Pegasus fork (PEGA-123): `task.custom_field_changed` lets the Pegasus Hub
// copy a card edit into the lead at once instead of on its 5-minute sync.

vi.mock("../../apps/api/src/plugins/generic-webhook/client", () => ({
  postToGenericWebhook: vi.fn(async () => ({ ok: true, status: 200 })),
}));
vi.mock("../../apps/api/src/utils/assert-public-destination", () => ({
  assertPublicDestination: vi.fn(async () => undefined),
}));
vi.mock(
  "../../apps/api/src/notification/controllers/create-notification",
  () => ({ default: vi.fn(async () => null) }),
);

type User = typeof schema.userTable.$inferSelect;
type Delivery = { event: string; actor: { id: string | null }; data: unknown };

beforeAll(() => {
  registerPlugin(genericWebhookPlugin);
  initializeEventSubscriptions();
});
beforeEach(async () => {
  await resetTestDatabase();
  vi.mocked(postToGenericWebhook).mockClear();
});
afterEach(() => vi.unstubAllEnvs());

function as(user: User) {
  mockAuthenticatedSession(user);
  const { app } = createApp();
  return (method: string, path: string, body: unknown) =>
    app.request(`/api${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
}

async function setup() {
  const member = await createWorkspaceMember({ role: "admin" });
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  await db.insert(schema.integrationTable).values({
    projectId: project.id,
    type: "generic-webhook",
    isActive: true,
    config: JSON.stringify({
      webhookUrl: "https://hub.example.com/kaneo",
      events: { taskCustomFieldChanged: true },
    }),
  });
  const [field] = await db
    .insert(schema.customFieldDefinitionTable)
    .values({ projectId: project.id, name: "Ort", type: "text", position: 0 })
    .returning();
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      columnId: columns.todo.id,
      title: "Max Muster",
      number: 900,
      status: "to-do",
    })
    .returning();

  return { member, project, field, task };
}

function fieldDeliveries() {
  return vi
    .mocked(postToGenericWebhook)
    .mock.calls.map(([, payload]) => payload as unknown as Delivery)
    .filter((payload) => payload.event === "task.custom_field_changed");
}

// publishEvent does not wait for its subscribers.
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 200));
}

describe("task.custom_field_changed webhook", () => {
  it("sends one event with the old and the new value per change", async () => {
    const { member, field, task } = await setup();
    const send = as(member.user);
    const setValue = (value: string) =>
      send("PUT", "/custom-field/value", {
        taskId: task.id,
        fieldId: field.id,
        value,
      });

    expect((await setValue("Bonn")).status).toBe(200);
    await vi.waitFor(() => expect(fieldDeliveries()).toHaveLength(1));
    expect((await setValue("Köln")).status).toBe(200);
    await vi.waitFor(() => expect(fieldDeliveries()).toHaveLength(2));
    await settle();

    expect(fieldDeliveries()).toMatchObject([
      {
        actor: { id: member.user.id },
        data: {
          fieldId: field.id,
          fieldName: "Ort",
          fieldType: "text",
          oldValue: null,
          newValue: "Bonn",
        },
      },
      { data: { oldValue: "Bonn", newValue: "Köln" } },
    ]);
  });

  it("sends null as the new value when a value is cleared", async () => {
    const { member, field, task } = await setup();
    await db
      .insert(schema.customFieldValueTable)
      .values({ taskId: task.id, fieldId: field.id, value: "Bonn" });

    await as(member.user)("PUT", "/custom-field/value", {
      taskId: task.id,
      fieldId: field.id,
      value: "",
    });

    await vi.waitFor(() => expect(fieldDeliveries()).toHaveLength(1));
    expect(fieldDeliveries()[0]?.data).toMatchObject({
      oldValue: "Bonn",
      newValue: null,
    });
  });

  it("sends nothing when the value stays the same", async () => {
    const { member, field, task } = await setup();
    await db
      .insert(schema.customFieldValueTable)
      .values({ taskId: task.id, fieldId: field.id, value: "Bonn" });

    const response = await as(member.user)("PUT", "/custom-field/value", {
      taskId: task.id,
      fieldId: field.id,
      value: " Bonn ",
    });
    expect(response.status).toBe(200);
    await settle();

    expect(fieldDeliveries()).toEqual([]);
  });

  it("sends the Hub's own changes with the Hub as actor", async () => {
    const { member, field, task } = await setup();
    const id = `user-${randomUUID()}`;
    const [hub] = await db
      .insert(schema.userTable)
      .values({ id, email: `${id}@example.com`, name: "Pegasus-Hub" })
      .returning();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: member.workspace.id,
      userId: hub.id,
      role: "admin",
      joinedAt: new Date(),
    });
    vi.stubEnv("PEGASUS_HUB_USER_ID", hub.id);

    await as(hub)("PUT", "/custom-field/value", {
      taskId: task.id,
      fieldId: field.id,
      value: "Bonn",
    });

    await vi.waitFor(() => expect(fieldDeliveries()).toHaveLength(1));
    expect(fieldDeliveries()[0]?.actor).toMatchObject({ id: hub.id });
  });

  it("sends nothing when a card is created with values", async () => {
    const { member, project, field } = await setup();

    const response = await as(member.user)("POST", `/task/${project.id}`, {
      title: "Neue Karte",
      description: "",
      priority: "low",
      status: "to-do",
      customFields: [{ fieldId: field.id, value: "Bonn" }],
    });
    expect(response.status).toBe(200);
    await settle();

    expect(fieldDeliveries()).toEqual([]);
  });
});

describe("taskCustomFieldChanged toggle", () => {
  it("is off by default and can be switched on in the webhook settings", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const send = as(member.user);
    const path = `/generic-webhook-integration/project/${project.id}`;

    const created = await send("POST", path, {
      webhookUrl: "https://hub.example.com/kaneo",
    });
    expect(created.status).toBe(200);
    expect(await created.json()).toMatchObject({
      events: { taskCustomFieldChanged: false },
    });

    const updated = await send("PATCH", path, {
      events: { taskCustomFieldChanged: true },
    });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({
      events: { taskCustomFieldChanged: true, taskCreated: true },
    });
  });
});
