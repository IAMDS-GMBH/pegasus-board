import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(resetTestDatabase);

async function setup() {
  const { user, workspace } = await createWorkspaceMember({ role: "owner" });
  const { project, columns } = await createProjectFixture({
    workspaceId: workspace.id,
  });
  mockAuthenticatedSession(user);
  const { app } = createApp();
  const send = (method: string, path: string, body?: object) =>
    app.request(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  return { project, columns, send };
}

// Pegasus fork (PEGA-170): columns carry a phase and a lock, which the Hub sets.
describe("column phase and lock API", () => {
  it("creates a column with phase and isLocked and lists them", async () => {
    const { project, send } = await setup();

    const created = await send("POST", `/api/column/${project.id}`, {
      name: "Eingang",
      phase: "Eingang und Datenprüfung",
      isLocked: true,
    });

    expect(created.status).toBe(200);
    expect(await created.json()).toMatchObject({
      name: "Eingang",
      phase: "Eingang und Datenprüfung",
      isLocked: true,
    });
    const listed = await send("GET", `/api/column/${project.id}`);
    expect(await listed.json()).toContainEqual(
      expect.objectContaining({
        slug: "eingang",
        phase: "Eingang und Datenprüfung",
        isLocked: true,
      }),
    );
  });

  it("defaults phase to null and isLocked to false", async () => {
    const { project, send } = await setup();

    const created = await send("POST", `/api/column/${project.id}`, {
      name: "Unbearbeitet",
    });

    expect(await created.json()).toMatchObject({
      phase: null,
      isLocked: false,
    });
  });

  it("updates phase and isLocked, and clears the phase with null or blank text", async () => {
    const { columns, send } = await setup();

    const updated = await send("PUT", `/api/column/${columns.todo.id}`, {
      phase: "  Kontaktaufnahme  ",
      isLocked: true,
    });
    expect(await updated.json()).toMatchObject({
      phase: "Kontaktaufnahme",
      isLocked: true,
    });

    const cleared = await send("PUT", `/api/column/${columns.todo.id}`, {
      phase: null,
      isLocked: false,
    });
    expect(await cleared.json()).toMatchObject({
      phase: null,
      isLocked: false,
    });

    await send("PUT", `/api/column/${columns.todo.id}`, { phase: "A" });
    const blank = await send("PUT", `/api/column/${columns.todo.id}`, {
      phase: "   ",
    });
    expect(await blank.json()).toMatchObject({ phase: null });
  });

  it("keeps phase and lock when only the name changes", async () => {
    const { columns, send } = await setup();
    await send("PUT", `/api/column/${columns.todo.id}`, {
      phase: "Eingang und Datenprüfung",
      isLocked: true,
    });

    const renamed = await send("PUT", `/api/column/${columns.todo.id}`, {
      name: "Neu",
    });

    expect(await renamed.json()).toMatchObject({
      name: "Neu",
      phase: "Eingang und Datenprüfung",
      isLocked: true,
    });
  });

  it("returns phase and isLocked on board columns", async () => {
    const { project, columns, send } = await setup();
    await send("PUT", `/api/column/${columns.todo.id}`, {
      phase: "Eingang und Datenprüfung",
      isLocked: true,
    });

    const board = await send("GET", `/api/task/tasks/${project.id}`);
    const { data } = (await board.json()) as {
      data: {
        columns: { slug: string; phase: string | null; isLocked: boolean }[];
      };
    };

    expect(data.columns.find((c) => c.slug === "to-do")).toMatchObject({
      phase: "Eingang und Datenprüfung",
      isLocked: true,
    });
    expect(data.columns.find((c) => c.slug === "done")).toMatchObject({
      phase: null,
      isLocked: false,
    });
  });

  // Nachtrag 26.11.2026: the restriction is set like the lock.
  it("creates, defaults, updates and keeps isRestricted, and returns it on board columns", async () => {
    const { project, columns, send } = await setup();

    const created = await send("POST", `/api/column/${project.id}`, {
      name: "Pegasus-Pool",
      isRestricted: true,
    });
    expect(await created.json()).toMatchObject({
      isLocked: false,
      isRestricted: true,
    });
    const plain = await send("POST", `/api/column/${project.id}`, {
      name: "Qualifizierung",
    });
    expect(await plain.json()).toMatchObject({ isRestricted: false });

    const updated = await send("PUT", `/api/column/${columns.todo.id}`, {
      isRestricted: true,
    });
    expect(await updated.json()).toMatchObject({ isRestricted: true });
    const renamed = await send("PUT", `/api/column/${columns.todo.id}`, {
      name: "Neu",
    });
    expect(await renamed.json()).toMatchObject({ isRestricted: true });

    const board = await send("GET", `/api/task/tasks/${project.id}`);
    const { data } = (await board.json()) as {
      data: { columns: { slug: string; isRestricted: boolean }[] };
    };
    expect(data.columns.find((c) => c.slug === "to-do")).toMatchObject({
      isRestricted: true,
    });
    expect(data.columns.find((c) => c.slug === "done")).toMatchObject({
      isRestricted: false,
    });

    const lifted = await send("PUT", `/api/column/${columns.todo.id}`, {
      isRestricted: false,
    });
    expect(await lifted.json()).toMatchObject({ isRestricted: false });
  });
});
