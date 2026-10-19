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

// Pegasus fork (PEGA-87): the `url` custom field type.
describe("url custom fields API", () => {
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
    extra: Record<string, unknown> = {},
  ) {
    return app.request(
      "/api/custom-field",
      json("POST", {
        projectId: project.id,
        name: "LinkedIn",
        type: "url",
        ...extra,
      }),
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

  async function storedValue(taskId: string, fieldId: string) {
    const [row] = await db
      .select({ value: schema.customFieldValueTable.value })
      .from(schema.customFieldValueTable)
      .where(eq(schema.customFieldValueTable.taskId, taskId));
    expect(row, `no value for field ${fieldId}`).toBeDefined();
    return row?.value;
  }

  it("stores a value as a normalized https link", async () => {
    const f = await createFixture();
    const field = await (await createField(f)).json();
    const task = await (await createTask(f)).json();

    const response = await f.app.request(
      "/api/custom-field/value",
      json("PUT", {
        taskId: task.id,
        fieldId: field.id,
        value: "  linkedin.com/in/max  ",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      value: "https://linkedin.com/in/max",
    });
    const values = await (
      await f.app.request(`/api/custom-field/task/${task.id}`)
    ).json();
    expect(values).toEqual([
      expect.objectContaining({
        fieldId: field.id,
        fieldType: "url",
        value: "https://linkedin.com/in/max",
      }),
    ]);
  });

  it.each([
    "javascript:alert(1)",
    "asdf",
    "ftp://example.org/file",
    "https://user:secret@example.org",
  ])("rejects %j as a value", async (value) => {
    const f = await createFixture();
    const field = await (await createField(f)).json();
    const task = await (await createTask(f)).json();

    const response = await f.app.request(
      "/api/custom-field/value",
      json("PUT", { taskId: task.id, fieldId: field.id, value }),
    );

    expect(response.status).toBe(400);
    expect((await readErrorBody(response)).message).toBe(
      "Value must be an http or https link",
    );
  });

  it("allows clearing an optional link", async () => {
    const f = await createFixture();
    const field = await (await createField(f)).json();
    const task = await (await createTask(f)).json();

    const response = await f.app.request(
      "/api/custom-field/value",
      json("PUT", { taskId: task.id, fieldId: field.id, value: "" }),
    );

    expect(response.status).toBe(200);
  });

  it("normalizes the default and fills existing tasks with it", async () => {
    const f = await createFixture();
    const task = await (await createTask(f)).json();

    const response = await createField(f, {
      defaultValue: "example.org/karriere",
    });

    expect(response.status).toBe(200);
    const field = await response.json();
    expect(field.defaultValue).toBe("https://example.org/karriere");
    expect(await storedValue(task.id, field.id)).toBe(
      "https://example.org/karriere",
    );
  });

  it("rejects an invalid default before creating the field", async () => {
    const f = await createFixture();

    const response = await createField(f, { defaultValue: "kein link" });

    expect(response.status).toBe(400);
    expect((await readErrorBody(response)).message).toContain(
      "expects an http or https link",
    );
    expect(await db.select().from(schema.customFieldDefinitionTable)).toEqual(
      [],
    );
  });

  it("normalizes and validates links passed when creating a task", async () => {
    const f = await createFixture();
    const field = await (await createField(f)).json();

    const created = await createTask(f, [
      { fieldId: field.id, value: "linkedin.com/in/erika" },
    ]);
    expect(created.status).toBe(200);
    const task = await created.json();
    expect(await storedValue(task.id, field.id)).toBe(
      "https://linkedin.com/in/erika",
    );

    const rejected = await createTask(f, [
      { fieldId: field.id, value: "javascript:alert(1)" },
    ]);
    expect(rejected.status).toBe(400);
    expect((await readErrorBody(rejected)).message).toContain(
      "expects an http or https link",
    );
  });

  it("normalizes an updated default and keeps the type fixed", async () => {
    const f = await createFixture();
    const field = await (await createField(f)).json();

    const updated = await f.app.request(
      `/api/custom-field/${field.id}`,
      json("PUT", { defaultValue: "example.org" }),
    );
    expect(updated.status).toBe(200);
    expect((await updated.json()).defaultValue).toBe("https://example.org/");

    const invalid = await f.app.request(
      `/api/custom-field/${field.id}`,
      json("PUT", { defaultValue: "mailto:max@example.org" }),
    );
    expect(invalid.status).toBe(400);

    const retyped = await f.app.request(
      `/api/custom-field/${field.id}`,
      json("PUT", { type: "text" }),
    );
    expect(retyped.status).toBe(400);
  });
});
