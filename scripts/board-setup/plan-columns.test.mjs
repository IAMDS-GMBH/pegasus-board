import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { planColumns, wantedColumnIds } from "./plan-columns.mjs";

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

// Pegasus fork (PEGA-170, Nachtrag 26.11.2026): like the Hub, the spec wins
// whenever the setup runs; changes in the board's settings stay until then.
const column = (fields) => ({
  position: 0,
  icon: null,
  isFinal: false,
  phase: null,
  isLocked: false,
  isRestricted: false,
  ...fields,
});

test("name, phase, lock and restriction are set back to the spec", () => {
  const columns = [
    column({
      id: "x",
      name: "Neu eingegangen",
      slug: "eingang",
      icon: "CircleDashed",
      phase: "Ruhend",
    }),
  ];
  const { actions } = planColumns(
    [
      {
        name: "Eingang",
        icon: "CircleDashed",
        phase: "Eingang und Datenprüfung",
        isLocked: true,
        isRestricted: true,
      },
    ],
    columns,
  );

  assert.deepEqual(actions, [
    {
      type: "update-column",
      id: "x",
      name: "Neu eingegangen",
      changes: {
        name: "Eingang",
        phase: "Eingang und Datenprüfung",
        isLocked: true,
        isRestricted: true,
      },
    },
  ]);
});

test("a lock the spec no longer has is lifted", () => {
  const columns = [
    column({
      id: "p",
      name: "Pegasus-Pool",
      slug: "pegasus-pool",
      icon: "Layers",
      phase: "Eingang und Datenprüfung",
      isLocked: true,
    }),
  ];
  const { actions } = planColumns(
    [spec.columns.find((c) => c.name === "Pegasus-Pool")],
    columns,
  );

  assert.deepEqual(actions[0].changes, { isLocked: false, isRestricted: true });
});

test("a column under its former name is renamed in place and keeps its slug", () => {
  const columns = [
    column({
      id: "u",
      name: "Unbearbeitet",
      slug: "unbearbeitet",
      icon: "Circle",
      phase: "Eingang und Datenprüfung",
    }),
  ];
  const { actions, warnings } = planColumns(
    [spec.columns.find((c) => c.name === "Qualifizierung")],
    columns,
  );

  assert.deepEqual(actions, [
    {
      type: "update-column",
      id: "u",
      name: "Unbearbeitet",
      changes: {
        name: "Qualifizierung",
        phase: "Kontaktaufnahme und Qualifizierung",
      },
    },
  ]);
  assert.deepEqual(warnings, []);
});

test("a new column is created with phase, lock and restriction, without the former name", () => {
  const { actions } = planColumns(
    [spec.columns.find((c) => c.name === "Qualifizierung"), spec.columns[0]],
    [],
  );

  assert.deepEqual(
    actions.map((a) => a.column),
    [
      {
        name: "Qualifizierung",
        icon: "Circle",
        phase: "Kontaktaufnahme und Qualifizierung",
      },
      {
        name: "Eingang",
        icon: "CircleDashed",
        phase: "Eingang und Datenprüfung",
        isLocked: true,
        isRestricted: true,
      },
    ],
  );
});

test("board.json has the 17 stages, the first phase restricted", () => {
  assert.equal(spec.columns.length, 17);
  const intake = spec.columns.filter(
    (c) => c.phase === "Eingang und Datenprüfung",
  );
  assert.deepEqual(
    intake.map((c) => [c.name, c.icon, c.isLocked ?? false]),
    [
      ["Eingang", "CircleDashed", true],
      ["Plausibilitätsprüfung", "Shield", true],
      ["Automatische Anreicherung", "Wand2", true],
      ["Manuelle Anreicherung", "PenTool", false],
      ["Pegasus-Pool", "Layers", false],
    ],
  );
  assert.deepEqual(
    spec.columns.filter((c) => c.isRestricted).map((c) => c.name),
    intake.map((c) => c.name),
  );
  assert.deepEqual(
    spec.columns
      .filter((c) => c.phase === "Kontaktaufnahme und Qualifizierung")
      .map((c) => c.name),
    [
      "Qualifizierung",
      "Nicht erreicht",
      "Mehrfach nicht erreicht",
      "Falsche Nummer",
      "In Kontakt",
    ],
  );
  assert.equal(
    spec.columns.find((c) => c.name === "Qualifizierung").formerName,
    "Unbearbeitet",
  );
  assert.ok(spec.columns.every((c) => !("fixedName" in c)));
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
    isRestricted: c.isRestricted ?? false,
  }));

  assert.deepEqual(planColumns(spec.columns, columns), {
    actions: [],
    warnings: [],
  });
});

test("the order finds a column under its former name", () => {
  const columns = [
    column({ id: "q", name: "Unbearbeitet", slug: "unbearbeitet" }),
    column({ id: "e", name: "Eingang", slug: "eingang" }),
  ];
  assert.deepEqual(wantedColumnIds(spec.columns, columns), ["e", "q"]);
});
