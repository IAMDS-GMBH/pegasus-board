import { expect } from "vite-plus/test";
import db, { schema } from "../../../apps/api/src/database";
import { createApp } from "../../../apps/api/src/index";
import { mockAuthenticatedSession } from "./auth";
import { createProjectFixture, createWorkspaceMember } from "./fixtures";

// Pegasus fork (PEGA-141): the test tree from SPEC Rollen & Rechte §12, with
// unit ids as plain strings. The Hub flattens the tree, so the board only
// ever sees unit sets:
//
//   WWK  U0 → U1 (OD 279) → U2 (FD 300) → U3 (BD 405): L1, L2
//                                       → U4 (BD 406): L3
//                           U2 itself: L5
//                         → U5 (FD 301) → U6 (BD 410): L4
//                         → U7 (FD 302) → U8 (BD 420): L6
//   1zu1 V3 (RD): M1
//
// N0 has no unit. L2 is assigned to the Bearbeiter.

export const HUB_ROLE = "fuehrungskraft";

export const HUB_ROLE_PERMISSION = {
  task: ["read", "update"],
  project: ["read"],
  workspace: ["read"],
};

const TASK_UNITS = {
  L1: "U3",
  L2: "U3",
  L3: "U4",
  L4: "U6",
  L5: "U2",
  L6: "U8",
  M1: "V3",
  N0: null,
} as const;

export type TaskName = keyof typeof TASK_UNITS;
export type User = typeof schema.userTable.$inferSelect;
export type App = ReturnType<typeof createApp>["app"];

type ScopeInput = {
  email: string;
  mode: "all" | "units" | "assigned";
  unitIds: string[];
};

async function addMember(workspaceId: string, email: string, role: string) {
  const [user] = await db
    .insert(schema.userTable)
    .values({ id: `user-${email}`, email, emailVerified: true, name: email })
    .returning();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: user.id,
    role,
    joinedAt: new Date(),
  });
  return user;
}

export function asUser(user: User): App {
  mockAuthenticatedSession(user);
  return createApp().app;
}

export async function createHubScopeFixture() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const workspace = owner.workspace;
  await db.insert(schema.workspaceRoleTable).values({
    workspaceId: workspace.id,
    role: HUB_ROLE,
    permission: JSON.stringify(HUB_ROLE_PERMISSION),
    hubScoped: true,
  });

  // fkBD's account email differs in case from what the Hub sends.
  const users = {
    fkBD: await addMember(workspace.id, "Fk-BD@WWK.test", HUB_ROLE),
    fkFD: await addMember(workspace.id, "fk-fd@wwk.test", HUB_ROLE),
    multi: await addMember(workspace.id, "multi@wwk.test", HUB_ROLE),
    all: await addMember(workspace.id, "all@wwk.test", HUB_ROLE),
    bearbeiter: await addMember(workspace.id, "bearbeiter@wwk.test", HUB_ROLE),
    noRow: await addMember(workspace.id, "no-row@wwk.test", HUB_ROLE),
    innendienst: await addMember(
      workspace.id,
      "innendienst@wwk.test",
      "member",
    ),
  };

  const { project, columns } = await createProjectFixture({
    workspaceId: workspace.id,
    name: "Bewerber-Pool",
    slug: "bew",
  });

  const tasks = {} as Record<TaskName, typeof schema.taskTable.$inferSelect>;
  const names = Object.keys(TASK_UNITS) as TaskName[];
  for (const [index, name] of names.entries()) {
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        columnId: columns.todo.id,
        title: `Lead ${name}`,
        description: `Notiz zu ${name}`,
        priority: "medium",
        status: "to-do",
        number: index + 1,
        position: index + 1,
        userId: name === "L2" ? users.bearbeiter.id : null,
      })
      .returning();
    tasks[name] = task;
  }

  const hub = asUser(owner.user);
  const put = async (path: string, body: unknown) => {
    const response = await hub.request(`/api/pegasus-visibility${path}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(response.status, path).toBe(200);
  };

  await put(`/workspace/${workspace.id}/tasks`, {
    tasks: names
      .filter((name) => TASK_UNITS[name] !== null)
      .map((name) => ({ taskId: tasks[name].id, unitId: TASK_UNITS[name] })),
  });

  const defaultScopes: ScopeInput[] = [
    { email: "fk-bd@wwk.test", mode: "units", unitIds: ["U3"] },
    { email: "fk-fd@wwk.test", mode: "units", unitIds: ["U2", "U3", "U4"] },
    { email: "multi@wwk.test", mode: "units", unitIds: ["U3", "U6", "U8"] },
    { email: "all@wwk.test", mode: "all", unitIds: [] },
    { email: "bearbeiter@wwk.test", mode: "assigned", unitIds: [] },
  ];
  const pushScopes = (scopes: ScopeInput[]) =>
    put(`/workspace/${workspace.id}/users`, { users: scopes });
  await pushScopes(defaultScopes);

  const idOf = new Map(names.map((name) => [tasks[name].id, name]));
  const namesOf = (ids: Iterable<string>) =>
    [...ids].map((id) => idOf.get(id) ?? id).sort();

  return {
    owner: owner.user,
    workspace,
    project,
    columns,
    users,
    tasks,
    defaultScopes,
    pushScopes,
    namesOf,
  };
}

export type HubScopeFixture = Awaited<ReturnType<typeof createHubScopeFixture>>;
