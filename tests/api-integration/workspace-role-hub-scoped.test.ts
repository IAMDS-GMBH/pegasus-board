import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { defaultRolePayloads } from "../../packages/permissions/src";
import { resetTestDatabase } from "./helpers/database";

// Pegasus fork (PEGA-141): the role editor saves `task:view_hub_scoped` as the
// role's `hubScoped` field, next to `assignedOnly`. Like that one it is a
// restriction, so it travels outside `permission` and only owner/admin set it.

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
  const rows = await db
    .select()
    .from(schema.workspaceRoleTable)
    .where(eq(schema.workspaceRoleTable.workspaceId, workspaceId));
  return rows.find((row) => row.role === "fuehrungskraft");
}

describe("API integration: hub-scoped role through the role editor", () => {
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
          additionalFields: { hubScoped: true },
        },
      );
      expect(created.status).toBe(200);
      let row = await roleRow(workspace.id);
      expect(row?.hubScoped).toBe(true);
      expect(row?.assignedOnly).toBe(false);
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
        hubScoped?: boolean;
      }>;
      expect(roles.find((r) => r.role === "fuehrungskraft")?.hubScoped).toBe(
        true,
      );

      const updated = await request(
        "/api/auth/organization/update-role",
        admin.cookie,
        {
          organizationId: workspace.id,
          roleName: "fuehrungskraft",
          data: { permission: FUEHRUNGSKRAFT_PERMISSION, hubScoped: false },
        },
      );
      expect(updated.status).toBe(200);
      row = await roleRow(workspace.id);
      expect(row?.hubScoped).toBe(false);
    });
  }

  it("does not let the restricted member lift its own restriction", async () => {
    const { lead, workspace } = await fixture("owner");
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: workspace.id,
      role: "fuehrungskraft",
      permission: JSON.stringify(FUEHRUNGSKRAFT_PERMISSION),
      hubScoped: true,
    });

    const result = await request(
      "/api/auth/organization/update-role",
      lead.cookie,
      {
        organizationId: workspace.id,
        roleName: "fuehrungskraft",
        data: { hubScoped: false },
      },
    );

    expect(result.status).toBe(403);
    expect((await roleRow(workspace.id))?.hubScoped).toBe(true);
  });
});
