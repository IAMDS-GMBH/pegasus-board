import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(resetTestDatabase);

type FieldSeed = Partial<
  typeof schema.customFieldDefinitionTable.$inferInsert
> & { type: string };

async function setup(fieldSeed: FieldSeed, value?: string) {
  const member = await createWorkspaceMember({ role: "admin" });
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [field] = await db
    .insert(schema.customFieldDefinitionTable)
    .values({
      projectId: project.id,
      name: "Paket",
      required: false,
      position: 0,
      ...fieldSeed,
    })
    .returning();
  if (value !== undefined) {
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Lead",
        number: 1,
        status: "to-do",
        columnId: columns.todo.id,
      })
      .returning();
    await db
      .insert(schema.customFieldValueTable)
      .values({ taskId: task.id, fieldId: field.id, value });
  }
  mockAuthenticatedSession(member.user);
  const { app } = createApp();
  const send = (method: string, path: string, body: object) =>
    app.request(`/api/custom-field${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  return {
    create: (body: object) =>
      send("POST", "", {
        projectId: project.id,
        required: false,
        ...body,
      }),
    update: (body: object) => send("PUT", `/${field.id}`, body),
  };
}

const dropdown = { type: "dropdown", options: ["Basis", "Plus"] };
const multiselect = { type: "multiselect", options: ["Basis", "Plus"] };

// Pegasus fork (PEGA-90): stable codes let the web show field errors in the
// user's language.
describe("custom field error codes", () => {
  it.each([
    {
      name: "a blank name on create",
      code: "CUSTOM_FIELD_NAME_REQUIRED",
      run: (api: Api) => api.create({ name: " ", type: "text" }),
    },
    {
      name: "a blank name on update",
      code: "CUSTOM_FIELD_NAME_REQUIRED",
      run: (api: Api) => api.update({ name: "" }),
    },
    {
      name: "a required field without a default",
      code: "CUSTOM_FIELD_DEFAULT_REQUIRED",
      run: (api: Api) =>
        api.create({ name: "PLZ", type: "text", required: true }),
    },
    {
      name: "a number default that is not a number",
      code: "CUSTOM_FIELD_INVALID_DEFAULT",
      run: (api: Api) =>
        api.create({ name: "Anzahl", type: "number", defaultValue: "abc" }),
    },
    {
      name: "a link default that is not a web link",
      code: "CUSTOM_FIELD_INVALID_DEFAULT",
      run: (api: Api) =>
        api.create({
          name: "Profil",
          type: "url",
          defaultValue: "javascript:alert(1)",
        }),
    },
    {
      name: "a dropdown default outside the options",
      code: "CUSTOM_FIELD_INVALID_DEFAULT",
      run: (api: Api) =>
        api.create({ name: "Tarif", ...dropdown, defaultValue: "Premium" }),
    },
    {
      name: "a dropdown without options",
      code: "CUSTOM_FIELD_TOO_FEW_OPTIONS",
      run: (api: Api) =>
        api.create({ name: "Tarif", type: "dropdown", options: [] }),
    },
    {
      name: "a multiselect with one option",
      code: "CUSTOM_FIELD_TOO_FEW_OPTIONS",
      run: (api: Api) =>
        api.create({ name: "Tarif", type: "multiselect", options: ["Basis"] }),
    },
    {
      name: "a type change",
      code: "CUSTOM_FIELD_TYPE_LOCKED",
      run: (api: Api) => api.update({ type: "number" }),
    },
    {
      name: "options on a text field",
      code: "CUSTOM_FIELD_OPTIONS_NOT_ALLOWED",
      run: (api: Api) => api.update({ options: ["Basis"] }),
    },
  ])("returns $code for $name", async ({ code, run }) => {
    const res = await run(await setup({ type: "text" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code });
  });

  it("returns CUSTOM_FIELD_OPTION_IN_USE when a used option is removed", async () => {
    const api = await setup(dropdown, "Plus");
    const res = await api.update({ options: ["Basis"] });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      code: "CUSTOM_FIELD_OPTION_IN_USE",
      message:
        'Can\'t remove "Plus" because tasks still use it. Pick a different option on those tasks first.',
    });
  });

  it("returns CUSTOM_FIELD_TASKS_HAVE_MULTIPLE_OPTIONS when a switch to dropdown would drop picks", async () => {
    const api = await setup(multiselect, JSON.stringify(["Basis", "Plus"]));
    const res = await api.update({ type: "dropdown" });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      code: "CUSTOM_FIELD_TASKS_HAVE_MULTIPLE_OPTIONS",
    });
  });

  it("returns CUSTOM_FIELD_INVALID_DEFAULT when a switch to dropdown keeps a default with several picks", async () => {
    const api = await setup({
      ...multiselect,
      defaultValue: JSON.stringify(["Basis", "Plus"]),
    });
    const res = await api.update({ type: "dropdown" });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      code: "CUSTOM_FIELD_INVALID_DEFAULT",
    });
  });
});

type Api = Awaited<ReturnType<typeof setup>>;
