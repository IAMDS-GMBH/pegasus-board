import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { defaultRolePayloads } from "../../packages/permissions/src";
import { resetTestDatabase } from "./helpers/database";
import { createProjectFixture } from "./helpers/fixtures";

// The role editor saves `task:view_assigned_only` as the role's `assignedOnly`
// field through better-auth's create-role / update-role. better-auth refuses to
// let anyone grant a permission they do not hold, so the restriction must not
// travel inside `permission`.

const origin = "http://localhost:5173";
const { app } = createApp();

function request(path: string, cookie: string, body?: unknown) {
  return app.request(path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      Origin: origin,
      Cookie: cookie,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function signup(email: string) {
  const result = await request("/api/auth/sign-up/email", "", {
    name: email,
    email,
    password: "long-password-for-tests",
  });
  expect(result.status).toBe(200);
  const body = await result.json();
  const cookie = result.headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");
  return { id: body.user.id as string, cookie };
}

const FUEHRUNGSKRAFT_PERMISSION = {
  task: ["read", "update"],
  project: ["read"],
  workspace: ["read"],
};

async function fixture(adminRole: "owner" | "admin") {
  const admin = await signup("admin@example.com");
  const lead = await signup("lead@example.com");
  const [workspace] = await db
    .insert(schema.workspaceTable)
    .values({
      id: "role-ws",
      name: "Pegasus",
      slug: "pegasus",
      createdAt: new Date(),
    })
    .returning();
  if (adminRole === "admin") {
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: workspace.id,
      role: "admin",
      permission: JSON.stringify(defaultRolePayloads.admin),
    });
  }
  await db.insert(schema.workspaceUserTable).values([
    {
      workspaceId: workspace.id,
      userId: admin.id,
      role: adminRole,
      joinedAt: new Date(),
    },
    {
      workspaceId: workspace.id,
      userId: lead.id,
      role: "fuehrungskraft",
      joinedAt: new Date(),
    },
  ]);
  return { admin, lead, workspace };
}

async function roleRow(workspaceId: string) {
  const [row] = await db
    .select()
    .from(schema.workspaceRoleTable)
    .where(eq(schema.workspaceRoleTable.workspaceId, workspaceId))
    .then((rows) => rows.filter((r) => r.role === "fuehrungskraft"));
  return row;
}

describe("API integration: assigned-only role through the role editor", () => {
  beforeEach(() => resetTestDatabase());

  for (const adminRole of ["owner", "admin"] as const) {
    it(`lets a workspace ${adminRole} create, list and update the restriction`, async () => {
      const { admin, workspace } = await fixture(adminRole);

      const created = await request(
        "/api/auth/organization/create-role",
        admin.cookie,
        {
          organizationId: workspace.id,
          role: "fuehrungskraft",
          permission: FUEHRUNGSKRAFT_PERMISSION,
          additionalFields: { assignedOnly: true },
        },
      );
      expect(created.status).toBe(200);
      let row = await roleRow(workspace.id);
      expect(row?.assignedOnly).toBe(true);
      expect(JSON.parse(row?.permission ?? "{}")).toEqual(
        FUEHRUNGSKRAFT_PERMISSION,
      );

      const listed = await request(
        `/api/auth/organization/list-roles?organizationId=${workspace.id}`,
        admin.cookie,
      );
      expect(listed.status).toBe(200);
      const roles = (await listed.json()) as Array<{
        role: string;
        assignedOnly?: boolean;
      }>;
      expect(roles.find((r) => r.role === "fuehrungskraft")?.assignedOnly).toBe(
        true,
      );

      const updated = await request(
        "/api/auth/organization/update-role",
        admin.cookie,
        {
          organizationId: workspace.id,
          roleName: "fuehrungskraft",
          data: { permission: FUEHRUNGSKRAFT_PERMISSION, assignedOnly: false },
        },
      );
      expect(updated.status).toBe(200);
      row = await roleRow(workspace.id);
      expect(row?.assignedOnly).toBe(false);
    });
  }

  it("does not let the restricted member lift its own restriction", async () => {
    const { lead, workspace } = await fixture("owner");
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: workspace.id,
      role: "fuehrungskraft",
      permission: JSON.stringify(FUEHRUNGSKRAFT_PERMISSION),
      assignedOnly: true,
    });

    const result = await request(
      "/api/auth/organization/update-role",
      lead.cookie,
      {
        organizationId: workspace.id,
        roleName: "fuehrungskraft",
        data: { assignedOnly: false },
      },
    );

    expect(result.status).toBe(403);
    expect((await roleRow(workspace.id))?.assignedOnly).toBe(true);
  });

  it("restricts the board of a member whose role was created in the editor", async () => {
    const { admin, lead, workspace } = await fixture("owner");
    const created = await request(
      "/api/auth/organization/create-role",
      admin.cookie,
      {
        organizationId: workspace.id,
        role: "fuehrungskraft",
        permission: FUEHRUNGSKRAFT_PERMISSION,
        additionalFields: { assignedOnly: true },
      },
    );
    expect(created.status).toBe(200);

    const { project, columns } = await createProjectFixture({
      workspaceId: workspace.id,
      slug: "pool",
    });
    const tasks = await db
      .insert(schema.taskTable)
      .values(
        [lead.id, admin.id, null].map((userId, index) => ({
          projectId: project.id,
          columnId: columns.todo.id,
          title: `Bewerber ${index + 1}`,
          status: "to-do",
          priority: "medium",
          number: index + 1,
          position: index + 1,
          userId,
        })),
      )
      .returning();

    const result = await request(`/api/task/tasks/${project.id}`, lead.cookie);
    expect(result.status).toBe(200);
    const body = (await result.json()) as {
      data: {
        columns: Array<{ tasks: Array<{ id: string }> }>;
        plannedTasks: Array<{ id: string }>;
        archivedTasks: Array<{ id: string }>;
      };
    };
    const ids = [
      ...body.data.columns.flatMap((column) =>
        column.tasks.map((task) => task.id),
      ),
      ...body.data.plannedTasks.map((task) => task.id),
      ...body.data.archivedTasks.map((task) => task.id),
    ];
    expect(ids).toEqual([tasks[0]?.id]);
  });
});
