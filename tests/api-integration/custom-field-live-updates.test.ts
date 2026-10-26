import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import createCustomField from "../../apps/api/src/custom-field/controllers/create-custom-field";
import deleteCustomField from "../../apps/api/src/custom-field/controllers/delete-custom-field";
import reorderCustomFields from "../../apps/api/src/custom-field/controllers/reorder-custom-field";
import setCustomFieldValue from "../../apps/api/src/custom-field/controllers/set-custom-field-value";
import updateCustomField from "../../apps/api/src/custom-field/controllers/update-custom-field";
import createTask from "../../apps/api/src/task/controllers/create-task";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const publish = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("../../apps/api/src/events", async (original) => ({
  ...(await original<object>()),
  publishEvent: publish,
}));

beforeEach(async () => {
  await resetTestDatabase();
  publish.mockClear();
});

async function setup() {
  const member = await createWorkspaceMember();
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
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
  return { member, project, task };
}

// Pegasus fork (PEGA-90): field changes reach other users without a reload.
describe("custom field live updates", () => {
  it("publishes a task update when a value is set or cleared", async () => {
    const { project, task } = await setup();
    const field = await createCustomField(project.id, "PLZ", "text", false);
    const required = await createCustomField(
      project.id,
      "Quelle",
      "text",
      true,
      "Web",
    );
    publish.mockClear();

    await expect(setCustomFieldValue(task.id, required.id, "")).rejects.toThrow(
      "This custom field is required",
    );
    await setCustomFieldValue(task.id, field.id, "80331");
    await setCustomFieldValue(task.id, field.id, "");

    expect(publish.mock.calls).toEqual(
      Array.from({ length: 2 }, () => [
        "task.updated",
        { taskId: task.id, projectId: project.id, customFieldsChanged: true },
      ]),
    );
  });

  it("publishes a project update when a field is created, updated, reordered or deleted", async () => {
    const { project } = await setup();
    const field = await createCustomField(
      project.id,
      "Paket",
      "dropdown",
      false,
      undefined,
      ["Basis", "Plus"],
    );
    await updateCustomField(field.id, { name: "Tarif" });
    await reorderCustomFields(project.id, [{ id: field.id, position: 0 }]);
    await deleteCustomField(field.id);

    expect(publish.mock.calls).toEqual(
      Array.from({ length: 4 }, () => [
        "project.updated",
        { projectId: project.id, customFieldsChanged: true },
      ]),
    );
  });

  it("does not publish when a field change is rejected", async () => {
    const { project, task } = await setup();
    const field = await createCustomField(
      project.id,
      "Paket",
      "dropdown",
      false,
      undefined,
      ["Basis", "Plus"],
    );
    await setCustomFieldValue(task.id, field.id, "Plus");
    publish.mockClear();

    await expect(
      updateCustomField(field.id, { options: ["Basis"] }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      reorderCustomFields(project.id, [{ id: "zz-missing", position: 0 }]),
    ).rejects.toMatchObject({ status: 400 });
    await expect(deleteCustomField("zz-missing")).rejects.toMatchObject({
      status: 404,
    });
    await updateCustomField(field.id, { name: "Tarif" });

    expect(publish).toHaveBeenCalledOnce();
  });

  it("marks a created task when it stores custom field values", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const field = await createCustomField(project.id, "PLZ", "text", false);
    publish.mockClear();

    await createTask({
      projectId: project.id,
      currentUserId: member.user.id,
      title: "Without fields",
      status: "to-do",
    });
    await createTask({
      projectId: project.id,
      currentUserId: member.user.id,
      title: "With fields",
      status: "to-do",
      customFields: [{ fieldId: field.id, value: "80331" }],
    });

    const created = publish.mock.calls.filter(
      ([event]) => event === "task.created",
    ) as unknown as Array<[string, Record<string, unknown>]>;
    expect(created.map(([, data]) => data.customFieldsChanged)).toEqual([
      undefined,
      true,
    ]);
  });
});
