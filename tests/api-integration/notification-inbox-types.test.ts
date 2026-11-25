import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import "../../apps/api/src/notification";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

// Pegasus fork (PEGA-66, for PEGA-156): with "Nur im Board" the Hub sends no
// mail and relies on the Board's inbox. Since PEGA-80 the Board has no
// notification settings page, so every kind of task event must reach the
// assignee's inbox on its own.

vi.mock("../../apps/api/src/events", async (original) => {
  const events = await original<typeof import("../../apps/api/src/events")>();
  return {
    ...events,
    // Assertions must wait for the notification subscribers to finish.
    publishEvent: (...args: Parameters<typeof events.publishEvent>) =>
      events.publishEvent(args[0], args[1], { waitForHandlers: true }),
  };
});

beforeEach(resetTestDatabase);

async function fixture() {
  const actor = await createWorkspaceMember({ role: "owner" });
  const assignee = await createWorkspaceMember();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId: actor.workspace.id,
    userId: assignee.user.id,
    role: "member",
    joinedAt: new Date(),
  });
  const { project, columns } = await createProjectFixture({
    workspaceId: actor.workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      columnId: columns.todo.id,
      title: "Lead",
      status: "to-do",
      number: 1,
      userId: assignee.user.id,
    })
    .returning();
  // Cards created through the API continue the numbering.
  await db
    .update(schema.projectTable)
    .set({ lastTaskNumber: 1 })
    .where(eq(schema.projectTable.id, project.id));
  mockAuthenticatedSession(actor.user);
  const { app } = createApp();
  const send = async (method: string, path: string, body: unknown) => {
    const response = await app.request(`/api${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(response.status, await response.clone().text()).toBe(200);
    return response;
  };
  return { actor, assignee, project, task, send };
}

const inbox = (userId: string, type: string) =>
  db
    .select()
    .from(schema.notificationTable)
    .where(
      and(
        eq(schema.notificationTable.userId, userId),
        eq(schema.notificationTable.type, type),
      ),
    );

describe("the assignee's inbox", () => {
  it("receives the assignment", async () => {
    const { assignee, task, send } = await fixture();
    await db
      .update(schema.taskTable)
      .set({ userId: null })
      .where(eq(schema.taskTable.id, task.id));

    await send("PUT", `/task/assignee/${task.id}`, {
      userId: assignee.user.id,
    });

    expect(await inbox(assignee.user.id, "task_assignee_changed")).toEqual([
      expect.objectContaining({ resourceId: task.id }),
    ]);
  });

  it("receives a task created for them", async () => {
    const { assignee, project, send } = await fixture();

    const response = await send("POST", `/task/${project.id}`, {
      title: "Neuer Lead",
      description: "",
      priority: "medium",
      status: "to-do",
      userId: assignee.user.id,
    });
    const created = (await response.json()) as { id: string };

    expect(await inbox(assignee.user.id, "task_created")).toEqual([
      expect.objectContaining({ resourceId: created.id }),
    ]);
  });

  it("receives a comment on their task", async () => {
    const { assignee, task, send } = await fixture();

    await send("POST", "/activity/comment", {
      taskId: task.id,
      comment: "Rückruf vereinbart",
    });

    expect(await inbox(assignee.user.id, "task_comment")).toEqual([
      expect.objectContaining({ resourceId: task.id }),
    ]);
  });

  it("receives a mention", async () => {
    const { assignee, task, send } = await fixture();

    await send("POST", "/activity/comment", {
      taskId: task.id,
      comment: `<kaneo-mention id="${assignee.user.id}"></kaneo-mention> bitte übernehmen`,
    });

    expect(await inbox(assignee.user.id, "task_mention")).toEqual([
      expect.objectContaining({ resourceId: task.id }),
    ]);
  });

  it("receives a status change", async () => {
    const { assignee, task, send } = await fixture();

    await send("PUT", `/task/status/${task.id}`, { status: "in-progress" });

    expect(await inbox(assignee.user.id, "task_status_changed")).toEqual([
      expect.objectContaining({ resourceId: task.id }),
    ]);
  });
});
