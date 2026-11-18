import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
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
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { readErrorBody } from "./helpers/error-body";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

// Pegasus fork (PEGA-123): field groups and the fields the Pegasus Hub owns.
// `hubDefined` locks the definition, `hubManaged` also the value, to the
// Hub's system account (PEGASUS_HUB_USER_ID); everyone else gets 403.

vi.mock(
  "../../apps/api/src/notification/controllers/create-notification",
  () => ({ default: vi.fn(async () => null) }),
);

type User = typeof schema.userTable.$inferSelect;

beforeEach(resetTestDatabase);
afterEach(() => vi.unstubAllEnvs());

async function addMember(
  workspaceId: string,
  role: string,
  { instanceAdmin = false } = {},
) {
  const id = `user-${randomUUID()}`;
  const [user] = await db
    .insert(schema.userTable)
    .values({
      id,
      email: `${id}@example.com`,
      emailVerified: true,
      name: role,
      role: instanceAdmin ? "admin" : undefined,
    })
    .returning();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: user.id,
    role,
    joinedAt: new Date(),
  });
  return user;
}

function as(user: User) {
  mockAuthenticatedSession(user);
  const { app } = createApp();
  return (method: string, path: string, body?: unknown) =>
    app.request(`/api${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
}

async function setup() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const workspaceId = owner.workspace.id;
  const { project, columns } = await createProjectFixture({ workspaceId });
  const hub = await addMember(workspaceId, "admin");
  vi.stubEnv("PEGASUS_HUB_USER_ID", hub.id);

  return {
    project,
    columns,
    users: {
      hub,
      owner: owner.user,
      admin: await addMember(workspaceId, "admin"),
      member: await addMember(workspaceId, "member"),
      instanceAdmin: await addMember(workspaceId, "member", {
        instanceAdmin: true,
      }),
    },
  };
}

async function seedField(
  projectId: string,
  values: Partial<typeof schema.customFieldDefinitionTable.$inferInsert> = {},
) {
  const [field] = await db
    .insert(schema.customFieldDefinitionTable)
    .values({ projectId, name: "Feld", type: "text", position: 0, ...values })
    .returning();
  return field;
}

async function seedTask(projectId: string, columnId: string) {
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId,
      columnId,
      title: "Karte",
      number: 900,
      status: "to-do",
    })
    .returning();
  return task;
}

async function readField(id: string) {
  const [field] = await db
    .select()
    .from(schema.customFieldDefinitionTable)
    .where(eq(schema.customFieldDefinitionTable.id, id));
  return field;
}

async function fieldNames(projectId: string) {
  const rows = await db
    .select({ name: schema.customFieldDefinitionTable.name })
    .from(schema.customFieldDefinitionTable)
    .where(eq(schema.customFieldDefinitionTable.projectId, projectId))
    .orderBy(asc(schema.customFieldDefinitionTable.position));
  return rows.map((row) => row.name);
}

const companyField = {
  name: "Gesellschaft",
  type: "dropdown",
  options: ["Allianz", "WWK"],
  section: "Versicherungstechnisch",
  showOnCard: true,
  hubDefined: true,
};

describe("custom field hub properties", () => {
  it("stores section and the hub flags on create and lists them", async () => {
    const { project, users } = await setup();
    const send = as(users.hub);

    const created = await send("POST", "/custom-field", {
      projectId: project.id,
      name: "Lead-ID",
      type: "text",
      section: "Herkunft",
      hubDefined: true,
      hubManaged: true,
    });
    expect(created.status).toBe(200);
    expect(await created.json()).toMatchObject({
      section: "Herkunft",
      hubDefined: true,
      hubManaged: true,
    });

    await send("POST", "/custom-field", {
      projectId: project.id,
      name: "Notiz",
      type: "text",
    });

    const list = await send("GET", `/custom-field/project/${project.id}`);
    expect(await list.json()).toMatchObject([
      {
        name: "Lead-ID",
        section: "Herkunft",
        hubDefined: true,
        hubManaged: true,
      },
      { name: "Notiz", section: null, hubDefined: false, hubManaged: false },
    ]);
  });

  it("returns the field's section and flags with task and project values", async () => {
    const { project, columns, users } = await setup();
    const field = await seedField(project.id, {
      name: "Pegasus-ID",
      section: "Versicherungstechnisch",
      hubDefined: true,
      hubManaged: true,
    });
    const task = await seedTask(project.id, columns.todo.id);
    await db
      .insert(schema.customFieldValueTable)
      .values({ taskId: task.id, fieldId: field.id, value: "P-1" });
    const send = as(users.member);

    const expected = {
      fieldSection: "Versicherungstechnisch",
      fieldHubDefined: true,
      fieldHubManaged: true,
    };
    const byTask = await send("GET", `/custom-field/task/${task.id}`);
    expect(await byTask.json()).toMatchObject([expected]);
    const byProject = await send(
      "GET",
      `/custom-field/project/${project.id}/values`,
    );
    expect(await byProject.json()).toMatchObject([expected]);
  });

  it("lets the Hub account change the section and the flags", async () => {
    const { project, users } = await setup();
    const field = await seedField(project.id, { name: "Quelle" });

    const response = await as(users.hub)("PUT", `/custom-field/${field.id}`, {
      section: "Herkunft",
      hubDefined: true,
      hubManaged: true,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      section: "Herkunft",
      hubDefined: true,
      hubManaged: true,
    });
  });

  describe("definitions owned by the Hub", () => {
    const NOT_HUB = ["admin", "owner", "instanceAdmin"] as const;

    it.each(NOT_HUB)("rejects creating a Hub field as %s", async (role) => {
      const { project, users } = await setup();
      const send = as(users[role]);

      for (const flag of ["hubDefined", "hubManaged"]) {
        const response = await send("POST", "/custom-field", {
          projectId: project.id,
          name: "Lead-ID",
          type: "text",
          [flag]: true,
        });
        expect(response.status).toBe(403);
        expect(await readErrorBody(response)).toMatchObject({
          code: "HUB_DEFINED_FIELD",
          fields: ["Lead-ID"],
        });
      }
      expect(await fieldNames(project.id)).toEqual([]);
    });

    it.each([
      ["a new name", { name: "Versicherer" }],
      ["a new type", { type: "multiselect" }],
      ["new options", { options: ["Allianz", "Andere"] }],
      ["required", { required: true, defaultValue: "Allianz" }],
      ["a default", { defaultValue: "Allianz" }],
      ["showOnCard", { showOnCard: false }],
      ["a section", { section: "Sonstiges" }],
      ["the flags", { hubDefined: false, hubManaged: false }],
    ])(
      "rejects %s for a Hub field from anyone but the Hub",
      async (_, body) => {
        const { project, users } = await setup();
        const field = await seedField(project.id, companyField);

        for (const role of NOT_HUB) {
          const response = await as(users[role])(
            "PUT",
            `/custom-field/${field.id}`,
            body,
          );
          expect(response.status).toBe(403);
          expect(await readErrorBody(response)).toMatchObject({
            code: "HUB_DEFINED_FIELD",
            fields: ["Gesellschaft"],
          });
        }
        expect(await readField(field.id)).toMatchObject(companyField);
      },
    );

    it("rejects turning a board field into a Hub field", async () => {
      const { project, users } = await setup();
      const field = await seedField(project.id, { name: "Notiz" });

      for (const flag of ["hubDefined", "hubManaged"]) {
        const response = await as(users.owner)(
          "PUT",
          `/custom-field/${field.id}`,
          { [flag]: true },
        );
        expect(response.status).toBe(403);
      }
      expect(await readField(field.id)).toMatchObject({
        hubDefined: false,
        hubManaged: false,
      });
    });

    it("lets only the Hub delete a Hub field", async () => {
      const { project, users } = await setup();
      const field = await seedField(project.id, companyField);

      for (const role of NOT_HUB) {
        const response = await as(users[role])(
          "DELETE",
          `/custom-field/${field.id}`,
        );
        expect(response.status).toBe(403);
        expect(await readErrorBody(response)).toMatchObject({
          code: "HUB_DEFINED_FIELD",
          fields: ["Gesellschaft"],
        });
      }
      expect(await fieldNames(project.id)).toEqual(["Gesellschaft"]);

      const response = await as(users.hub)(
        "DELETE",
        `/custom-field/${field.id}`,
      );
      expect(response.status).toBe(200);
      expect(await fieldNames(project.id)).toEqual([]);
    });

    it("lets the Hub change a Hub field", async () => {
      const { project, users } = await setup();
      const field = await seedField(project.id, companyField);

      const response = await as(users.hub)("PUT", `/custom-field/${field.id}`, {
        options: ["Allianz", "WWK", "Sonstige"],
        section: "Versicherung",
      });

      expect(response.status).toBe(200);
      expect(await readField(field.id)).toMatchObject({
        options: ["Allianz", "WWK", "Sonstige"],
        section: "Versicherung",
      });
    });

    it("still lets admins reorder Hub fields", async () => {
      const { project, users } = await setup();
      const first = await seedField(project.id, {
        ...companyField,
        position: 0,
      });
      const second = await seedField(project.id, {
        name: "Ort",
        hubDefined: true,
        position: 1,
      });

      const response = await as(users.admin)(
        "PUT",
        `/custom-field/reorder/${project.id}`,
        {
          fields: [
            { id: first.id, position: 1 },
            { id: second.id, position: 0 },
          ],
        },
      );

      expect(response.status).toBe(200);
      expect(await fieldNames(project.id)).toEqual(["Ort", "Gesellschaft"]);
    });

    it("leaves board fields to the board", async () => {
      const { project, users } = await setup();
      const send = as(users.admin);
      const created = await send("POST", "/custom-field", {
        projectId: project.id,
        name: "Notiz",
        type: "text",
        section: "Termin",
      });
      const { id } = (await created.json()) as { id: string };

      expect(
        (await send("PUT", `/custom-field/${id}`, { name: "Notizen" })).status,
      ).toBe(200);
      expect((await send("DELETE", `/custom-field/${id}`)).status).toBe(200);
    });
  });

  describe("values only the Hub sets", () => {
    const NOT_HUB = ["member", "admin", "owner", "instanceAdmin"] as const;

    async function leadIdSetup() {
      const f = await setup();
      const leadId = await seedField(f.project.id, {
        name: "Lead-ID",
        section: "Herkunft",
        hubDefined: true,
        hubManaged: true,
        position: 0,
      });
      const city = await seedField(f.project.id, {
        name: "Ort",
        hubDefined: true,
        position: 1,
      });
      const task = await seedTask(f.project.id, f.columns.todo.id);
      await db.insert(schema.customFieldValueTable).values([
        { taskId: task.id, fieldId: leadId.id, value: "lead-1" },
        { taskId: task.id, fieldId: city.id, value: "Bonn" },
      ]);
      return { ...f, leadId, city, task };
    }

    async function storedValues(taskId: string) {
      const rows = await db
        .select({
          name: schema.customFieldDefinitionTable.name,
          value: schema.customFieldValueTable.value,
        })
        .from(schema.customFieldValueTable)
        .innerJoin(
          schema.customFieldDefinitionTable,
          eq(
            schema.customFieldDefinitionTable.id,
            schema.customFieldValueTable.fieldId,
          ),
        )
        .where(eq(schema.customFieldValueTable.taskId, taskId));
      return Object.fromEntries(rows.map((row) => [row.name, row.value]));
    }

    it("lets the Hub set, change and clear the value", async () => {
      const f = await leadIdSetup();
      const send = as(f.users.hub);

      for (const value of ["lead-2", ""]) {
        const response = await send("PUT", "/custom-field/value", {
          taskId: f.task.id,
          fieldId: f.leadId.id,
          value,
        });
        expect(response.status).toBe(200);
        expect((await storedValues(f.task.id))["Lead-ID"]).toBe(value);
      }
    });

    it.each(NOT_HUB)("rejects setting or clearing it as %s", async (role) => {
      const f = await leadIdSetup();
      const send = as(f.users[role]);

      for (const value of ["lead-2", ""]) {
        const response = await send("PUT", "/custom-field/value", {
          taskId: f.task.id,
          fieldId: f.leadId.id,
          value,
        });
        expect(response.status).toBe(403);
        expect(await readErrorBody(response)).toMatchObject({
          code: "HUB_MANAGED_FIELD",
          fields: ["Lead-ID"],
        });
      }
      expect(await storedValues(f.task.id)).toMatchObject({
        "Lead-ID": "lead-1",
      });
    });

    it("still lets members edit Hub fields that are not hubManaged", async () => {
      const f = await leadIdSetup();

      const response = await as(f.users.member)("PUT", "/custom-field/value", {
        taskId: f.task.id,
        fieldId: f.city.id,
        value: "Köln",
      });

      expect(response.status).toBe(200);
      expect((await storedValues(f.task.id)).Ort).toBe("Köln");
    });

    function createCard(
      f: Awaited<ReturnType<typeof leadIdSetup>>,
      value: string,
    ) {
      return {
        title: "Neue Karte",
        description: "",
        priority: "low",
        status: "to-do",
        customFields: [
          { fieldId: f.leadId.id, value },
          { fieldId: f.city.id, value: "Ulm" },
        ],
      };
    }

    it("rejects a new card with the value from a member", async () => {
      const f = await leadIdSetup();

      const response = await as(f.users.member)(
        "POST",
        `/task/${f.project.id}`,
        createCard(f, "lead-9"),
      );

      expect(response.status).toBe(403);
      expect(await readErrorBody(response)).toMatchObject({
        code: "HUB_MANAGED_FIELD",
        fields: ["Lead-ID"],
      });
      const tasks = await db
        .select()
        .from(schema.taskTable)
        .where(eq(schema.taskTable.projectId, f.project.id));
      expect(tasks).toHaveLength(1);
    });

    it("creates a card with the value from the Hub", async () => {
      const f = await leadIdSetup();

      const response = await as(f.users.hub)(
        "POST",
        `/task/${f.project.id}`,
        createCard(f, "lead-9"),
      );

      expect(response.status).toBe(200);
      const { id } = (await response.json()) as { id: string };
      expect(await storedValues(id)).toEqual({
        "Lead-ID": "lead-9",
        Ort: "Ulm",
      });
    });

    it("duplicates a card without the value", async () => {
      const f = await leadIdSetup();

      for (const role of ["member", "hub"] as const) {
        const response = await as(f.users[role])(
          "POST",
          `/task/duplicate/${f.task.id}`,
          {},
        );
        expect(response.status).toBe(200);
        const { id } = (await response.json()) as { id: string };
        expect(await storedValues(id)).toEqual({ Ort: "Bonn" });
      }
    });

    it("does not write values through update, bulk update or import", async () => {
      const f = await leadIdSetup();
      const send = as(f.users.member);
      const customFields = [{ fieldId: f.leadId.id, value: "lead-x" }];

      await send("PUT", `/task/${f.task.id}`, {
        title: "Karte",
        priority: "low",
        status: "to-do",
        projectId: f.project.id,
        position: 0,
        customFields,
      });
      await send("PATCH", "/task/bulk", {
        taskIds: [f.task.id],
        operation: "updatePriority",
        value: "high",
        customFields,
      });
      const imported = await send("POST", `/task/import/${f.project.id}`, {
        tasks: [{ title: "Import", status: "to-do", customFields }],
      });
      expect(imported.status).toBe(200);

      expect(await storedValues(f.task.id)).toMatchObject({
        "Lead-ID": "lead-1",
      });
      const values = await db.select().from(schema.customFieldValueTable);
      expect(values.filter((row) => row.value === "lead-x")).toEqual([]);
    });
  });
});
