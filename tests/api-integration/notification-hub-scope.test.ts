import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import createComment from "../../apps/api/src/activity/controllers/create-comment";
import db, { schema } from "../../apps/api/src/database";
import createNotification from "../../apps/api/src/notification/controllers/create-notification";
import getNotifications from "../../apps/api/src/notification/controllers/get-notifications";
import setNotificationRead from "../../apps/api/src/notification/controllers/set-notification-read";
import updateDescription from "../../apps/api/src/task/controllers/update-task-description";
import { resetTestDatabase } from "./helpers/database";
import {
  createHubScopeFixture,
  type HubScopeFixture,
  LEAD_RIGHTS,
  type User,
} from "./helpers/hub-scope-fixture";

// Pegasus fork (PEGA-141): notifications follow the task scope. Creating,
// listing and delivering skip recipients who cannot see the task, so a
// mention never mails a lead's name to someone outside its unit.

const { deliverNotification } = await vi.importActual<
  typeof import("../../apps/api/src/notification-preferences/delivery")
>("../../apps/api/src/notification-preferences/delivery");

const { publish, sendEmail } = vi.hoisted(() => ({
  publish: vi.fn(),
  sendEmail: vi.fn(async () => undefined),
}));
vi.mock("../../apps/api/src/events", async (original) => ({
  ...(await original<object>()),
  publishEvent: publish,
}));
vi.mock("@kaneo/email", async (original) => ({
  ...(await original<object>()),
  sendNotificationEmail: sendEmail,
}));
vi.mock("../../apps/api/src/notification-preferences/delivery", () => ({
  deliverNotification: vi.fn(async () => undefined),
}));

function mention(user: User) {
  return `<kaneo-mention id="${user.id}">${user.name}</kaneo-mention> bitte zurückrufen`;
}

async function notificationsOf(user: User) {
  const rows = await db.select().from(schema.notificationTable);
  return rows.filter((row) => row.userId === user.id);
}

async function enableEmail(f: HubScopeFixture, user: User) {
  await db
    .insert(schema.userNotificationPreferenceTable)
    .values({ userId: user.id, emailEnabled: true });
  await db.insert(schema.userNotificationWorkspaceRuleTable).values({
    userId: user.id,
    workspaceId: f.workspace.id,
    isActive: true,
    emailEnabled: true,
  });
}

describe("notifications under the hub scope", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    vi.clearAllMocks();
  });

  it("creates nothing for an @mention outside the recipient's units", async () => {
    const f = await createHubScopeFixture();

    await createComment(f.tasks.L4.id, f.owner.id, mention(f.users.fkBD));
    await updateDescription({
      id: f.tasks.L4.id,
      currentUserId: f.owner.id,
      description: mention(f.users.fkBD),
    });

    expect(await notificationsOf(f.users.fkBD)).toEqual([]);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("still notifies a mention inside the recipient's units", async () => {
    const f = await createHubScopeFixture();

    await createComment(f.tasks.L1.id, f.owner.id, mention(f.users.fkBD));

    const rows = await notificationsOf(f.users.fkBD);
    expect(rows.map((row) => row.type)).toEqual(["task_mention"]);
  });

  it("hides and stops delivering a notification once the task leaves the scope", async () => {
    const f = await createHubScopeFixture();
    await enableEmail(f, f.users.fkBD);
    const notification = await createNotification({
      userId: f.users.fkBD.id,
      resourceType: "task",
      resourceId: f.tasks.L1.id,
      type: "task_comment",
      eventData: { taskTitle: f.tasks.L1.title },
    });
    if (!notification) throw new Error("Expected a notification for fkBD");
    expect(await getNotifications(f.users.fkBD.id)).toHaveLength(1);

    await f.pushScopes(
      f.defaultScopes.map((scope) =>
        scope.email === "fk-bd@wwk.test"
          ? { ...scope, unitIds: ["U4"] }
          : scope,
      ),
    );

    expect(await getNotifications(f.users.fkBD.id)).toEqual([]);
    await expect(
      setNotificationRead(notification.id, f.users.fkBD.id, true),
    ).rejects.toMatchObject({ status: 404 });
    await deliverNotification(notification.id);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("keeps delivering by email inside the scope", async () => {
    const f = await createHubScopeFixture();
    await enableEmail(f, f.users.fkBD);
    const notification = await createNotification({
      userId: f.users.fkBD.id,
      resourceType: "task",
      resourceId: f.tasks.L1.id,
      type: "task_comment",
      eventData: { taskTitle: f.tasks.L1.title },
    });
    if (!notification) throw new Error("Expected a notification for fkBD");

    await deliverNotification(notification.id);

    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("counts only visible tasks in the email's column counter", async () => {
    const f = await createHubScopeFixture();
    await enableEmail(f, f.users.fkBD);
    const notification = await createNotification({
      userId: f.users.fkBD.id,
      resourceType: "task",
      resourceId: f.tasks.L1.id,
      type: "task_comment",
      eventData: { taskTitle: f.tasks.L1.title },
    });
    if (!notification) throw new Error("Expected a notification for fkBD");

    await deliverNotification(notification.id);

    expect(sendEmail).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        task: expect.objectContaining({
          column: expect.objectContaining({ count: 2 }),
        }),
      }),
    );
  });

  // The assignee clause once named a column the task table does not have.
  it("lists a Bearbeiter's notifications on the cards assigned to them", async () => {
    const f = await createHubScopeFixture();
    for (const name of ["L1", "L2"] as const) {
      await db.insert(schema.notificationTable).values({
        userId: f.users.bearbeiter.id,
        type: "task_comment",
        resourceType: "task",
        resourceId: f.tasks[name].id,
        eventData: { taskTitle: f.tasks[name].title },
      });
    }

    const rows = await getNotifications(f.users.bearbeiter.id);

    expect(rows.map((row) => row.resourceId)).toEqual([f.tasks.L2.id]);
  });

  // Pegasus fork (PEGA-170, Nachtrag 26.11.2026): a status change naming a
  // restricted column reaches only those who see restricted columns.
  describe("status changes through restricted columns", () => {
    async function restrictPool(f: HubScopeFixture) {
      await db.insert(schema.columnTable).values([
        {
          projectId: f.project.id,
          name: "Pegasus-Pool",
          slug: "pegasus-pool",
          position: 10,
          isRestricted: true,
        },
        {
          projectId: f.project.id,
          name: "Qualifizierung",
          slug: "qualifizierung",
          position: 11,
        },
      ]);
    }
    const statusChange = (f: HubScopeFixture, user: User, oldStatus: string) =>
      createNotification({
        userId: user.id,
        resourceType: "task",
        resourceId: f.tasks.L1.id,
        type: "task_status_changed",
        eventData: {
          taskTitle: f.tasks.L1.title,
          oldStatus,
          newStatus: "qualifizierung",
          projectId: f.project.id,
        },
      });

    it("creates none for a leader without LEAD_READ_INTAKE, but one for the owner", async () => {
      const f = await createHubScopeFixture();
      await restrictPool(f);

      expect(await statusChange(f, f.users.fkBD, "pegasus-pool")).toBeNull();
      expect(await statusChange(f, f.users.fkBD, "to-do")).not.toBeNull();
      expect(await statusChange(f, f.owner, "pegasus-pool")).not.toBeNull();
      await f.pushPermissions("fk-bd@wwk.test", [
        ...LEAD_RIGHTS,
        "LEAD_READ_INTAKE",
      ]);
      expect(
        await statusChange(f, f.users.fkBD, "pegasus-pool"),
      ).not.toBeNull();
    });

    it("hides older ones from the list and stops delivering them", async () => {
      const f = await createHubScopeFixture();
      await enableEmail(f, f.users.fkBD);
      const notification = await statusChange(f, f.users.fkBD, "pegasus-pool");
      if (!notification) throw new Error("Expected a notification for fkBD");
      expect(await getNotifications(f.users.fkBD.id)).toHaveLength(1);

      await restrictPool(f);

      expect(await getNotifications(f.users.fkBD.id)).toEqual([]);
      await deliverNotification(notification.id);
      expect(sendEmail).not.toHaveBeenCalled();
    });
  });
});
