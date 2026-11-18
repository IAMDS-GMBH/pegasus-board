import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

// Pegasus fork (PEGA-123): the Hub creates `Vorname` and `Nachname` as
// required fields without a default; nobody may empty them on a card.

vi.mock(
  "../../apps/api/src/notification/controllers/create-notification",
  () => ({ default: vi.fn(async () => null) }),
);

beforeEach(resetTestDatabase);

async function setup({ withTask = false } = {}) {
  const member = await createWorkspaceMember({ role: "admin" });
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [task] = withTask
    ? await db
        .insert(schema.taskTable)
        .values({
          projectId: project.id,
          columnId: columns.todo.id,
          title: "Karte",
          number: 900,
          status: "to-do",
        })
        .returning()
    : [];
  mockAuthenticatedSession(member.user);
  const { app } = createApp();
  const send = (method: string, path: string, body: unknown) =>
    app.request(`/api${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const createField = (body: object) =>
    send("POST", "/custom-field", { projectId: project.id, ...body });
  return { project, task, send, createField };
}

async function storedValue(taskId: string, fieldId: string) {
  const [row] = await db
    .select({ value: schema.customFieldValueTable.value })
    .from(schema.customFieldValueTable)
    .where(
      and(
        eq(schema.customFieldValueTable.taskId, taskId),
        eq(schema.customFieldValueTable.fieldId, fieldId),
      ),
    );
  return row?.value;
}

describe("required custom fields without a default", () => {
  it("creates one in a project without tasks", async () => {
    const { createField } = await setup();

    const response = await createField({
      name: "Nachname",
      type: "text",
      required: true,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      required: true,
      defaultValue: null,
    });
  });

  it("rejects one while a task has no value", async () => {
    const { createField } = await setup({ withTask: true });

    const response = await createField({
      name: "Nachname",
      type: "text",
      required: true,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "CUSTOM_FIELD_REQUIRED_MISSING_VALUES",
    });
  });

  it("rejects a new card without a value", async () => {
    const { project, send, createField } = await setup();
    await createField({ name: "Nachname", type: "text", required: true });

    const response = await send("POST", `/task/${project.id}`, {
      title: "Neue Karte",
      description: "",
      priority: "low",
      status: "to-do",
    });

    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain(
      'Custom field "Nachname" is required',
    );
  });

  it("rejects clearing a value", async () => {
    const { project, send, createField } = await setup();
    const field = (await (
      await createField({ name: "Nachname", type: "text", required: true })
    ).json()) as { id: string };
    const created = await send("POST", `/task/${project.id}`, {
      title: "Neue Karte",
      description: "",
      priority: "low",
      status: "to-do",
      customFields: [{ fieldId: field.id, value: "Muster" }],
    });
    const task = (await created.json()) as { id: string };

    const response = await send("PUT", "/custom-field/value", {
      taskId: task.id,
      fieldId: field.id,
      value: " ",
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "CUSTOM_FIELD_VALUE_REQUIRED",
    });
    expect(await storedValue(task.id, field.id)).toBe("Muster");
  });
});

describe("date custom fields with a time", () => {
  it("stores an ISO date-time unchanged", async () => {
    const { task, send, createField } = await setup({ withTask: true });
    const field = (await (
      await createField({ name: "Termin", type: "date" })
    ).json()) as { id: string };

    const response = await send("PUT", "/custom-field/value", {
      taskId: task.id,
      fieldId: field.id,
      value: "2026-10-28T12:00:00.000Z",
    });

    expect(response.status).toBe(200);
    expect(await storedValue(task.id, field.id)).toBe(
      "2026-10-28T12:00:00.000Z",
    );
  });
});
