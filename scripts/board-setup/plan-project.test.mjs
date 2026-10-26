import assert from "node:assert/strict";
import { test } from "node:test";
import { planProject } from "./plan-project.mjs";

const spec = { name: "Bewerber-Pool", slug: "BEW", icon: "Users" };

test("a missing project is created", () => {
  assert.deepEqual(planProject(spec, []), {
    action: { type: "create-project", project: spec },
  });
});

test("the project is found by slug, whatever the case", () => {
  const project = {
    id: "p",
    name: "Bewerber-Pool",
    slug: "bew",
    archivedAt: null,
  };
  assert.deepEqual(planProject(spec, [project]), { project, warnings: [] });
});

test("an archived project stops the run", () => {
  const project = {
    id: "p",
    name: "Bewerber-Pool",
    slug: "BEW",
    archivedAt: "2026-10-01",
  };
  assert.match(planProject(spec, [project]).error, /archiviert/);
});

test("a different project name is reported, not changed", () => {
  const project = { id: "p", name: "Pool", slug: "BEW", archivedAt: null };
  assert.match(planProject(spec, [project]).warnings[0], /Pool/);
});
