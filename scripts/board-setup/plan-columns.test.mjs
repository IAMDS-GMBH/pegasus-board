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

// Pegasus fork (PEGA-170): a name or phase changed in the board's column
// settings stays; only the names the Hub reads columns by are fixed.
test("a name changed in the board stays", () => {
  const columns = [
    {
      id: "u",
      name: "Neu",
      slug: "unbearbeitet",
      position: 0,
      icon: "Circle",
      isFinal: false,
      phase: "Eingang und Datenprüfung",
      isLocked: false,
    },
  ];
  const { actions } = planColumns(
    [
      {
        name: "Unbearbeitet",
        icon: "Circle",
        phase: "Eingang und Datenprüfung",
      },
    ],
    columns,
  );

  assert.deepEqual(actions, []);
});

test("a column with a fixed name is found by its slug and renamed back", () => {
  const columns = [
    {
      id: "x",
      name: "Neu eingegangen",
      slug: "eingang",
      position: 0,
      icon: "CircleDashed",
      isFinal: false,
      phase: "Eingang und Datenprüfung",
      isLocked: true,
    },
  ];
  const { actions } = planColumns(
    [
      {
        name: "Eingang",
        icon: "CircleDashed",
        phase: "Eingang und Datenprüfung",
        isLocked: true,
        fixedName: true,
      },
    ],
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

test("a new column is created with phase and lock, without the fixedName flag", () => {
  const { actions } = planColumns(
    [
      {
        name: "Eingang",
        icon: "CircleDashed",
        phase: "Eingang und Datenprüfung",
        isLocked: true,
        fixedName: true,
      },
    ],
    [],
  );

  assert.deepEqual(actions, [
    {
      type: "create-column",
      column: {
        name: "Eingang",
        icon: "CircleDashed",
        phase: "Eingang und Datenprüfung",
        isLocked: true,
      },
    },
  ]);
});

test("an existing column without a phase gets phase and lock", () => {
  const columns = [
    {
      id: "p",
      name: "Pegasus-Pool",
      slug: "pegasus-pool",
      position: 0,
      icon: "Layers",
      isFinal: false,
      phase: null,
      isLocked: false,
    },
  ];
  const { actions } = planColumns(
    [
      {
        name: "Pegasus-Pool",
        icon: "Layers",
        phase: "Eingang und Datenprüfung",
        isLocked: true,
      },
    ],
    columns,
  );

  assert.deepEqual(actions[0].changes, {
    phase: "Eingang und Datenprüfung",
    isLocked: true,
  });
});

test("a phase and lock changed in the board stay", () => {
  const columns = [
    {
      id: "w",
      name: "Wiedervorlage",
      slug: "wiedervorlage",
      position: 0,
      icon: "Clock",
      isFinal: false,
      phase: "Ruhend",
      isLocked: true,
    },
  ];
  const { actions } = planColumns(
    [
      {
        name: "Wiedervorlage",
        icon: "Clock",
        phase: "Wiedervorlage, Rückgabe und Abschluss",
      },
    ],
    columns,
  );

  assert.deepEqual(actions, []);
});

test("retired columns are removed, other extra columns stay", () => {
  const columns = [
    {
      id: "a",
      name: "Ablage",
      slug: "ablage",
      position: 0,
      icon: "Archive",
      isFinal: true,
      phase: null,
      isLocked: false,
    },
    {
      id: "z",
      name: "Sonderfälle",
      slug: "sonderfälle",
      position: 1,
      icon: null,
      isFinal: false,
      phase: null,
      isLocked: false,
    },
  ];
  const { actions, warnings } = planColumns([], columns, ["Ablage"]);

  assert.deepEqual(actions, [
    { type: "delete-column", id: "a", name: "Ablage" },
  ]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Sonderfälle/);
});

test("board.json retires the columns of 18052", () => {
  assert.deepEqual(spec.retiredColumns, [
    "Telefonqualifizierung",
    "Zugeordnet",
    "Kontaktiert",
    "Termin vereinbart",
    "Einstellungsbereit / Übergabe BSI",
    "Ablage",
  ]);
  assert.deepEqual(
    spec.columns.filter((c) => c.fixedName).map((c) => c.name),
    ["Eingang", "Rückgabe an Pegasus"],
  );
});

test("icon and done flag are corrected", () => {
  const columns = [
    {
      id: "a",
      name: "Absage",
      slug: "absage",
      position: 0,
      icon: null,
      isFinal: false,
      phase: "Wiedervorlage, Rückgabe und Abschluss",
      isLocked: false,
    },
  ];
  const { actions } = planColumns(
    [
      {
        name: "Absage",
        icon: "Archive",
        isFinal: true,
        phase: "Wiedervorlage, Rückgabe und Abschluss",
      },
    ],
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
    phase: c.phase ?? null,
    isLocked: c.isLocked ?? false,
  }));

  assert.deepEqual(planColumns(spec.columns, columns), {
    actions: [],
    warnings: [],
  });
});
