import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import { asUser } from "./helpers/hub-scope-fixture";

// Pegasus fork (PEGA-143): a user the Hub lists in a workspace's snapshot
// becomes a member without an invitation, once their account has a verified
// email: on the push for existing accounts, at creation and sign-in for the
// others, with the workspace's read-only role `pegasus`. Nobody is removed and
// no existing role changes; a workspace without that role adds nobody.

const PASSWORD = "correct horse battery staple";

async function setup({ pegasusRole = true } = {}) {
  const owner = await createWorkspaceMember({ role: "owner" });
  if (pegasusRole) {
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: owner.workspace.id,
      role: "pegasus",
      permission: JSON.stringify({ task: ["read"], project: ["read"] }),
    });
  }
  const push = async (emails: string[]) => {
    const response = await asUser(owner.user).request(
      `/api/pegasus-visibility/workspace/${owner.workspace.id}/users`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          users: emails.map((email) => ({
            email,
            mode: "assigned",
            unitIds: [],
            permissions: ["LEAD_READ"],
          })),
        }),
      },
    );
    expect(response.status).toBe(200);
  };
  const memberships = async () =>
    db
      .select({
        userId: schema.workspaceUserTable.userId,
        role: schema.workspaceUserTable.role,
      })
      .from(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.workspaceId, owner.workspace.id));
  const roleOf = async (userId: string) =>
    (await memberships())
      .filter((membership) => membership.userId === userId)
      .map((membership) => membership.role);
  return { owner, workspace: owner.workspace, push, memberships, roleOf };
}

async function addAccount(email: string, emailVerified: boolean) {
  const [user] = await db
    .insert(schema.userTable)
    .values({ id: `user-${email}`, email, emailVerified, name: email })
    .returning();
  return user;
}

describe("workspace membership from the Hub snapshot", () => {
  beforeEach(() => resetTestDatabase());

  describe("when the Hub pushes a snapshot", () => {
    it("adds listed accounts with a verified email as members", async () => {
      const s = await setup();
      // The account's email differs in case from what the Hub sends.
      const listed = await addAccount("Bearbeiter@WWK.test", true);
      const unverified = await addAccount("unverified@wwk.test", false);
      const unlisted = await addAccount("unlisted@wwk.test", true);

      await s.push(["bearbeiter@wwk.test", "unverified@wwk.test"]);

      expect(await s.roleOf(listed.id)).toEqual(["pegasus"]);
      expect(await s.roleOf(unverified.id)).toEqual([]);
      expect(await s.roleOf(unlisted.id)).toEqual([]);
    });

    it("adds nobody while the workspace has no role pegasus", async () => {
      const s = await setup({ pegasusRole: false });
      const listed = await addAccount("bearbeiter@wwk.test", true);

      await s.push(["bearbeiter@wwk.test"]);

      expect(await s.roleOf(listed.id)).toEqual([]);
    });

    it("keeps existing members and their role, and adds nobody twice", async () => {
      const s = await setup();
      const admin = await addAccount("fk@wwk.test", true);
      await db.insert(schema.workspaceUserTable).values({
        workspaceId: s.workspace.id,
        userId: admin.id,
        role: "admin",
        joinedAt: new Date(),
      });
      const listed = await addAccount("bearbeiter@wwk.test", true);

      await s.push(["fk@wwk.test", "bearbeiter@wwk.test"]);
      await s.push(["fk@wwk.test", "bearbeiter@wwk.test"]);
      // Leaving someone out removes nobody.
      await s.push([]);

      expect(await s.roleOf(admin.id)).toEqual(["admin"]);
      expect(await s.roleOf(listed.id)).toEqual(["pegasus"]);
      expect(await s.roleOf(s.owner.user.id)).toEqual(["owner"]);
    });
  });

  describe("when the account is created or signs in after the push", () => {
    it("adds an account created with a verified email", async () => {
      const s = await setup();
      await s.push(["neu@wwk.test"]);

      const context = await auth.$context;
      const user = await context.internalAdapter.createUser({
        email: "neu@wwk.test",
        name: "Neu",
        emailVerified: true,
      });

      expect(await s.roleOf(user.id)).toEqual(["pegasus"]);
    });

    it("adds an account at sign-in once its email is verified", async () => {
      const s = await setup();
      await s.push(["spaeter@wwk.test", "elsewhere@wwk.test"]);
      const { app } = createApp();
      const credentials = {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "spaeter@wwk.test",
          password: PASSWORD,
          name: "Später",
        }),
      };

      const signUp = await app.request("/api/auth/sign-up/email", credentials);
      expect(signUp.status).toBe(200);
      const { user } = (await signUp.json()) as { user: { id: string } };
      // Self-registered emails are not verified: no membership yet.
      expect(await s.roleOf(user.id)).toEqual([]);

      await db
        .update(schema.userTable)
        .set({ emailVerified: true })
        .where(eq(schema.userTable.id, user.id));
      const signIn = await app.request("/api/auth/sign-in/email", credentials);
      expect(signIn.status).toBe(200);

      expect(await s.roleOf(user.id)).toEqual(["pegasus"]);
    });

    it("adds nobody whose email no snapshot lists", async () => {
      const s = await setup();
      await s.push(["bearbeiter@wwk.test"]);

      const context = await auth.$context;
      const user = await context.internalAdapter.createUser({
        email: "unlisted@wwk.test",
        name: "Unlisted",
        emailVerified: true,
      });

      expect(await s.roleOf(user.id)).toEqual([]);
      expect(await s.memberships()).toHaveLength(1);
    });
  });
});
