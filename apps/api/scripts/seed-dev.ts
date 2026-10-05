// Dev-only seed: three users, one workspace, one board with assigned tasks.
// Re-running resets only the rows this script owns (matched by email/slug).
import { defaultRolePayloads, DEFAULT_ROLE_NAMES } from "@kaneo/permissions";
import bcrypt from "bcryptjs";
import { eq, inArray } from "drizzle-orm";
import db, { getDatabasePool, schema } from "../src/database";
import { DEFAULT_PROJECT_COLUMNS } from "../src/project/controllers/create-project";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed: NODE_ENV is production.");
  process.exit(1);
}

const WORKSPACE_SLUG = "seed-workspace";
const RESTRICTED_ROLE = "fuehrungskraft";

const USERS = [
  {
    key: "admin",
    name: "Admin",
    email: "admin@seed.test",
    password: "admin123",
    instanceRole: "admin",
    workspaceRole: "owner",
  },
  {
    key: "anna",
    name: "Anna",
    email: "anna@seed.test",
    password: "anna123",
    instanceRole: null,
    workspaceRole: RESTRICTED_ROLE,
  },
  {
    key: "ben",
    name: "Ben",
    email: "ben@seed.test",
    password: "ben123",
    instanceRole: null,
    workspaceRole: "member",
  },
] as const;

type UserKey = (typeof USERS)[number]["key"];
type ColumnSlug = (typeof DEFAULT_PROJECT_COLUMNS)[number]["slug"];

const TASKS: { title: string; assignee: UserKey | null; column: ColumnSlug }[] =
  [
    { title: "Admin – Rollen prüfen", assignee: "admin", column: "to-do" },
    {
      title: "Admin – Board aufsetzen",
      assignee: "admin",
      column: "in-progress",
    },
    { title: "Admin – Release freigeben", assignee: "admin", column: "done" },
    { title: "Anna – Bewerbung prüfen", assignee: "anna", column: "to-do" },
    {
      title: "Anna – Kundentermin vorbereiten",
      assignee: "anna",
      column: "in-progress",
    },
    {
      title: "Anna – Angebot abstimmen",
      assignee: "anna",
      column: "in-review",
    },
    { title: "Ben – Vertrag anlegen", assignee: "ben", column: "to-do" },
    { title: "Ben – Rückruf Kunde", assignee: "ben", column: "in-review" },
    { title: "Ben – Unterlagen archivieren", assignee: "ben", column: "done" },
    { title: "Niemand – Offene Anfrage", assignee: null, column: "to-do" },
    { title: "Niemand – Ideen sammeln", assignee: null, column: "in-progress" },
    { title: "Niemand – Altlasten aufräumen", assignee: null, column: "done" },
  ];

const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

await db.transaction(async (tx) => {
  // Cascades remove members, roles, accounts, sessions, projects and tasks.
  await tx
    .delete(schema.workspaceTable)
    .where(eq(schema.workspaceTable.slug, WORKSPACE_SLUG));
  await tx.delete(schema.userTable).where(
    inArray(
      schema.userTable.email,
      USERS.map((u) => u.email),
    ),
  );

  const now = new Date();
  const userIds = {} as Record<UserKey, string>;

  for (const u of USERS) {
    const [user] = await tx
      .insert(schema.userTable)
      .values({
        name: u.name,
        email: u.email,
        emailVerified: true,
        role: u.instanceRole,
      })
      .returning();
    userIds[u.key] = user.id;

    await tx.insert(schema.accountTable).values({
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: await bcrypt.hash(u.password, 10),
      updatedAt: now,
    });
  }

  const [workspace] = await tx
    .insert(schema.workspaceTable)
    .values({ name: "Seed Workspace", slug: WORKSPACE_SLUG, createdAt: now })
    .returning();

  await tx.insert(schema.workspaceRoleTable).values([
    ...DEFAULT_ROLE_NAMES.map((role) => ({
      workspaceId: workspace.id,
      role,
      permission: JSON.stringify(defaultRolePayloads[role]),
    })),
    {
      workspaceId: workspace.id,
      role: RESTRICTED_ROLE,
      permission: JSON.stringify({
        task: ["read", "update"],
        project: ["read"],
        workspace: ["read"],
      }),
      assignedOnly: true,
    },
  ]);

  await tx.insert(schema.workspaceUserTable).values(
    USERS.map((u) => ({
      workspaceId: workspace.id,
      userId: userIds[u.key],
      role: u.workspaceRole,
      joinedAt: now,
    })),
  );

  const [project] = await tx
    .insert(schema.projectTable)
    .values({
      workspaceId: workspace.id,
      name: "Seed Board",
      slug: "seed",
      icon: "Layout",
      lastTaskNumber: TASKS.length,
    })
    .returning();

  const columns = await tx
    .insert(schema.columnTable)
    .values(
      DEFAULT_PROJECT_COLUMNS.map((col) => ({ ...col, projectId: project.id })),
    )
    .returning();
  const columnIds = new Map(columns.map((c) => [c.slug, c.id]));

  await tx.insert(schema.taskTable).values(
    TASKS.map((t, i) => ({
      projectId: project.id,
      title: t.title,
      description: "",
      status: t.column,
      columnId: columnIds.get(t.column),
      userId: t.assignee ? userIds[t.assignee] : null,
      priority: PRIORITIES[i % PRIORITIES.length],
      number: i + 1,
      position: i,
    })),
  );
});

console.log("Seeded workspace “Seed Workspace” with board “Seed Board”.\n");
console.table(
  USERS.map((u) => ({
    email: u.email,
    password: u.password,
    role: u.workspaceRole,
  })),
);

await getDatabasePool().end();
