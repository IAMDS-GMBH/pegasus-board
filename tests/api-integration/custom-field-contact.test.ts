import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { readErrorBody } from "./helpers/error-body";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

// Pegasus fork (PEGA-86): the `email` and `phone` custom field types.
describe("email and phone custom fields API", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  async function createFixture() {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const [column] = await db
      .select({ slug: schema.columnTable.slug })
      .from(schema.columnTable)
      .where(eq(schema.columnTable.projectId, project.id))
      .limit(1);
    if (!column) throw new Error("project has no column");

    return { app, project, status: column.slug };
  }

  type Fixture = Awaited<ReturnType<typeof createFixture>>;

  function json(method: string, body: unknown) {
    return {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    };
  }

  async function createField(
    { app, project }: Fixture,
    type: string,
    extra: Record<string, unknown> = {},
  ) {
    return app.request(
      "/api/custom-field",
      json("POST", { projectId: project.id, name: "Kontakt", type, ...extra }),
    );
  }

  async function createTask(
    { app, project, status }: Fixture,
    customFields?: Array<{ fieldId: string; value: string }>,
  ) {
    return app.request(
      `/api/task/${project.id}`,
      json("POST", {
        title: "Bewerber",
        description: "",
        status,
        priority: "no-priority",
        customFields,
      }),
    );
  }

  async function setValue(
    { app }: Fixture,
    taskId: string,
    fieldId: string,
    value: string,
  ) {
    return app.request(
      "/api/custom-field/value",
      json("PUT", { taskId, fieldId, value }),
    );
  }

  async function storedValue(taskId: string, fieldId: string) {
    const [row] = await db
      .select({ value: schema.customFieldValueTable.value })
      .from(schema.customFieldValueTable)
      .where(eq(schema.customFieldValueTable.fieldId, fieldId));
    expect(row, `no value for task ${taskId}`).toBeDefined();
    return row?.value;
  }

  it.each([
    ["email", "  max@example.org ", "max@example.org"],
    ["phone", " +49 170   1234567 ", "+49 170 1234567"],
  ])(
    "stores %s values in their normalized form",
    async (type, input, stored) => {
      const f = await createFixture();
      const field = await (await createField(f, type)).json();
      const task = await (await createTask(f)).json();

      const response = await setValue(f, task.id, field.id, input);

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ value: stored });
      const values = await (
        await f.app.request(`/api/custom-field/task/${task.id}`)
      ).json();
      expect(values).toEqual([
        expect.objectContaining({ fieldType: type, value: stored }),
      ]);
    },
  );

  it.each([
    ["email", "max(at)example.org", "Value must be an email address"],
    [
      "email",
      "max@example.org?cc=boss@example.org",
      "Value must be an email address",
    ],
    ["phone", "keine Angabe", "Value must be a phone number"],
    ["phone", "tel:01701234567", "Value must be a phone number"],
  ])("rejects the %s value %j", async (type, value, message) => {
    const f = await createFixture();
    const field = await (await createField(f, type)).json();
    const task = await (await createTask(f)).json();

    const response = await setValue(f, task.id, field.id, value);

    expect(response.status).toBe(400);
    expect((await readErrorBody(response)).message).toBe(message);
  });

  it.each(["email", "phone"])(
    "allows clearing an optional %s field",
    async (type) => {
      const f = await createFixture();
      const field = await (await createField(f, type)).json();
      const task = await (await createTask(f)).json();

      expect((await setValue(f, task.id, field.id, "")).status).toBe(200);
    },
  );

  it.each([
    ["email", "max(at)example.org", "expects an email address"],
    ["phone", "keine Angabe", "expects a phone number"],
  ])(
    "rejects an invalid %s value passed when creating a task",
    async (type, value, message) => {
      const f = await createFixture();
      const field = await (await createField(f, type)).json();

      const response = await createTask(f, [{ fieldId: field.id, value }]);

      expect(response.status).toBe(400);
      expect((await readErrorBody(response)).message).toContain(message);
      expect(await db.select().from(schema.taskTable)).toEqual([]);
    },
  );

  it("stores contact values passed when creating a task", async () => {
    const f = await createFixture();
    const phone = await (await createField(f, "phone")).json();

    const response = await createTask(f, [
      { fieldId: phone.id, value: "0170  1234567" },
    ]);

    expect(response.status).toBe(200);
    const task = await response.json();
    expect(await storedValue(task.id, phone.id)).toBe("0170 1234567");
  });

  it("rejects an invalid default before creating the field", async () => {
    const f = await createFixture();

    const response = await createField(f, "phone", {
      defaultValue: "keine Angabe",
    });

    expect(response.status).toBe(400);
    expect((await readErrorBody(response)).message).toContain(
      "expects a phone number",
    );
    expect(await db.select().from(schema.customFieldDefinitionTable)).toEqual(
      [],
    );
  });

  it("converts a text field to phone and normalizes its task values", async () => {
    const f = await createFixture();
    const field = await (await createField(f, "text")).json();
    const task = await (await createTask(f)).json();
    await setValue(f, task.id, field.id, "0170  1234567");

    const response = await f.app.request(
      `/api/custom-field/${field.id}`,
      json("PUT", { type: "phone" }),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).type).toBe("phone");
    expect(await storedValue(task.id, field.id)).toBe("0170 1234567");
  });

  it("refuses to convert a text field to email while a task has a value that isn't one", async () => {
    const f = await createFixture();
    const field = await (await createField(f, "text")).json();
    const task = await (await createTask(f)).json();
    await setValue(f, task.id, field.id, "max(at)example.org");

    const response = await f.app.request(
      `/api/custom-field/${field.id}`,
      json("PUT", { type: "email" }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: "CUSTOM_FIELD_TASKS_HAVE_INVALID_VALUES",
      message:
        "Some tasks have a value that isn't an email address. Correct or clear those values first.",
    });
    const [definition] = await db
      .select({ type: schema.customFieldDefinitionTable.type })
      .from(schema.customFieldDefinitionTable);
    expect(definition?.type).toBe("text");
    expect(await storedValue(task.id, field.id)).toBe("max(at)example.org");
  });

  it("switches a phone field back to text and keeps its values", async () => {
    const f = await createFixture();
    const field = await (await createField(f, "phone")).json();
    const task = await (await createTask(f)).json();
    await setValue(f, task.id, field.id, "0170 1234567");

    const response = await f.app.request(
      `/api/custom-field/${field.id}`,
      json("PUT", { type: "text" }),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).type).toBe("text");
    expect(await storedValue(task.id, field.id)).toBe("0170 1234567");
  });
});
