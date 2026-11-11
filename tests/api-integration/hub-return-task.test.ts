import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
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
  LEAD_RIGHTS,
} from "./helpers/hub-scope-fixture";

// Pegasus fork (PEGA-143): the assignee gives a card back to its unit
// (`PUT /task/return/{id}`). A member the Hub governs needs
// LEAD_RETURN_OR_REPORT; anyone else task:update. Tree:
// helpers/hub-scope-fixture.ts (L2 is assigned to the Bearbeiter).

// Background notifications would race the next test's TRUNCATE.
vi.mock(
  "../../apps/api/src/notification/controllers/create-notification",
  () => ({ default: vi.fn(async () => null) }),
);

const publish = vi.hoisted(() => vi.fn());
vi.mock("../../apps/api/src/events", async (original) => {
  const events = await original<typeof import("../../apps/api/src/events")>();
  publish.mockImplementation(events.publishEvent);
  return { ...events, publishEvent: publish };
});

const BEARBEITER = "bearbeiter@wwk.test";
const BEARBEITER_RIGHTS = [
  "LEAD_READ",
  "LEAD_EDIT",
  "LEAD_MOVE_STAGE",
  "LEAD_RETURN_OR_REPORT",
];

function returnTask(app: App, taskId: string) {
  return app.request(`/api/task/return/${taskId}`, { method: "PUT" });
}

async function assigneeOf(taskId: string) {
  const [task] = await db
    .select({ userId: schema.taskTable.userId })
    .from(schema.taskTable)
    .where(eq(schema.taskTable.id, taskId));
  return task?.userId;
}

describe("return a task to its unit", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    publish.mockClear();
  });

  describe("in a workspace the Hub manages", () => {
    it("unassigns the Bearbeiter's card as an unassignment by the Bearbeiter", async () => {
      const f = await createHubScopeFixture();
      await f.pushPermissions(BEARBEITER, BEARBEITER_RIGHTS);
      const app = asUser(f.users.bearbeiter);

      const response = await returnTask(app, f.tasks.L2.id);

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        id: f.tasks.L2.id,
        userId: null,
      });
      expect(await assigneeOf(f.tasks.L2.id)).toBeNull();
      // The event drives activity, live updates, notifications and the
      // generic webhook `task.unassigned`, which the Hub reads as "returned".
      expect(publish).toHaveBeenCalledWith(
        "task.unassigned",
        expect.objectContaining({
          taskId: f.tasks.L2.id,
          userId: f.users.bearbeiter.id,
          oldAssignee: f.users.bearbeiter.id,
          newAssigneeId: null,
          type: "unassigned",
        }),
      );
      await vi.waitFor(async () => {
        const activities = await db
          .select()
          .from(schema.activityTable)
          .where(
            and(
              eq(schema.activityTable.taskId, f.tasks.L2.id),
              eq(schema.activityTable.type, "unassigned"),
            ),
          );
        expect(activities).toEqual([
          expect.objectContaining({ userId: f.users.bearbeiter.id }),
        ]);
      });
      // Assigned-only: the card is gone for the Bearbeiter.
      expect((await app.request(`/api/task/${f.tasks.L2.id}`)).status).toBe(
        404,
      );
    });

    it("refuses a governed assignee without LEAD_RETURN_OR_REPORT", async () => {
      const f = await createHubScopeFixture();
      await f.pushPermissions(BEARBEITER, LEAD_RIGHTS);

      const response = await returnTask(
        asUser(f.users.bearbeiter),
        f.tasks.L2.id,
      );

      expect(response.status).toBe(403);
      expect(await readErrorBody(response)).toMatchObject({
        code: "MISSING_PERMISSION",
        missingPermissions: ["LEAD_RETURN_OR_REPORT"],
      });
      expect(await assigneeOf(f.tasks.L2.id)).toBe(f.users.bearbeiter.id);
      expect(publish).not.toHaveBeenCalledWith(
        "task.unassigned",
        expect.anything(),
      );
    });

    it("refuses anyone but the assignee, even with the right", async () => {
      const f = await createHubScopeFixture();
      // fk-bd sees L1 (unassigned) and L2 (the Bearbeiter's).
      await f.pushPermissions("fk-bd@wwk.test", [
        ...LEAD_RIGHTS,
        "LEAD_RETURN_OR_REPORT",
      ]);
      const app = asUser(f.users.fkBD);

      for (const task of [f.tasks.L1, f.tasks.L2]) {
        const response = await returnTask(app, task.id);
        expect(response.status, task.title).toBe(403);
        expect(await readErrorBody(response)).toMatchObject({
          code: "NOT_TASK_ASSIGNEE",
        });
      }
      expect(await assigneeOf(f.tasks.L2.id)).toBe(f.users.bearbeiter.id);
    });

    it("answers 404 for an unknown task and one the Bearbeiter cannot see", async () => {
      const f = await createHubScopeFixture();
      await f.pushPermissions(BEARBEITER, BEARBEITER_RIGHTS);
      const app = asUser(f.users.bearbeiter);

      expect((await returnTask(app, "no-such-task")).status).toBe(404);
      expect((await returnTask(app, f.tasks.L1.id)).status).toBe(404);
    });
  });

  describe("in a workspace the Hub does not manage", () => {
    async function setup() {
      const member = await createWorkspaceMember({ role: "member" });
      const other = await createWorkspaceMember({ role: "member" });
      await db
        .update(schema.workspaceUserTable)
        .set({ workspaceId: member.workspace.id })
        .where(eq(schema.workspaceUserTable.userId, other.user.id));
      const { project, columns } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      const [task] = await db
        .insert(schema.taskTable)
        .values({
          projectId: project.id,
          columnId: columns.todo.id,
          title: "Lead",
          status: "to-do",
          number: 1,
          userId: member.user.id,
        })
        .returning();
      return { member, other, task };
    }

    it("lets the assignee give back their own task with task:update", async () => {
      const { member, task } = await setup();

      const response = await returnTask(asUser(member.user), task.id);

      expect(response.status).toBe(200);
      expect(await assigneeOf(task.id)).toBeNull();
    });

    it("refuses another member", async () => {
      const { other, task } = await setup();

      const response = await returnTask(asUser(other.user), task.id);

      expect(response.status).toBe(403);
      expect(await assigneeOf(task.id)).toBe(task.userId);
    });
  });
});
