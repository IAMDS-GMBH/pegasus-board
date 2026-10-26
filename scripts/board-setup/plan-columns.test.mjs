import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { planColumns } from "./plan-columns.mjs";

const spec = JSON.parse(
  readFileSync(new URL("./board.json", import.meta.url), "utf8"),
);

const defaults = [
  {
    id: "c1",
    name: "To Do",
    slug: "to-do",
    position: 0,
    icon: null,
    isFinal: false,
  },
  {
    id: "c2",
    name: "In Progress",
    slug: "in-progress",
    position: 1,
    icon: null,
    isFinal: false,
  },
  {
    id: "c3",
    name: "In Review",
    slug: "in-review",
    position: 2,
    icon: null,
    isFinal: false,
  },
  {
    id: "c4",
    name: "Done",
    slug: "done",
    position: 3,
    icon: null,
    isFinal: true,
  },
];

test("a new project gets every column and loses Kaneo's defaults", () => {
  const { actions, warnings } = planColumns(spec.columns, defaults);

  assert.deepEqual(
    actions.filter((a) => a.type === "create-column").map((a) => a.column.name),
    spec.columns.map((c) => c.name),
  );
  assert.deepEqual(
    actions.filter((a) => a.type === "delete-column").map((a) => a.id),
    ["c1", "c2", "c3", "c4"],
  );
  assert.deepEqual(warnings, []);
});

test("a column renamed in the UI is found by its slug and renamed back", () => {
  const columns = [
    {
      id: "x",
      name: "Neu eingegangen",
      slug: "eingang",
      position: 0,
      icon: "CircleDashed",
      isFinal: false,
    },
  ];
  const { actions } = planColumns(
    [{ name: "Eingang", icon: "CircleDashed" }],
    columns,
  );

  assert.deepEqual(actions, [
    {
      type: "update-column",
      id: "x",
      name: "Neu eingegangen",
      changes: { name: "Eingang" },
    },
  ]);
});

test("icon and done flag are corrected", () => {
  const columns = [
    {
      id: "a",
      name: "Ablage",
      slug: "ablage",
      position: 0,
      icon: null,
      isFinal: false,
    },
  ];
  const { actions } = planColumns(
    [{ name: "Ablage", icon: "Archive", isFinal: true }],
    columns,
  );

  assert.deepEqual(actions[0].changes, { icon: "Archive", isFinal: true });
});

test("a column outside the spec stays and is reported", () => {
  const columns = [
    {
      id: "e",
      name: "Eingang",
      slug: "eingang",
      position: 0,
      icon: "CircleDashed",
      isFinal: false,
    },
    {
      id: "z",
      name: "Sonderfälle",
      slug: "sonderfälle",
      position: 1,
      icon: null,
      isFinal: false,
    },
  ];
  const { actions, warnings } = planColumns(
    [{ name: "Eingang", icon: "CircleDashed" }],
    columns,
  );

  assert.deepEqual(actions, []);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Sonderfälle/);
});

test("a board that matches the spec needs nothing", () => {
  const columns = spec.columns.map((c, position) => ({
    id: `c${position}`,
    name: c.name,
    slug: c.name.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, "-"),
    position,
    icon: c.icon,
    isFinal: c.isFinal ?? false,
  }));

  assert.deepEqual(planColumns(spec.columns, columns), {
    actions: [],
    warnings: [],
  });
});
