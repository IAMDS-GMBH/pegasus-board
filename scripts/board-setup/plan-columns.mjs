import { toSlug } from "./to-slug.mjs";

// Columns every new project starts with (DEFAULT_PROJECT_COLUMNS in
// apps/api/src/project/controllers/insert-project.ts). They are removed while
// empty; the API refuses to delete a column that still holds tasks.
export const DEFAULT_COLUMN_SLUGS = [
  "to-do",
  "in-progress",
  "in-review",
  "done",
];

// A column of the spec: by slug (unchanged by a rename in the board), by
// name, or by the name it had in an earlier spec (`formerName`), like the Hub.
export function matchColumn(spec, columns) {
  const byName = (name) =>
    columns.find((c) => c.slug === toSlug(name)) ??
    columns.find((c) => c.name === name);
  return (
    byName(spec.name) ??
    (spec.formerName === undefined ? undefined : byName(spec.formerName))
  );
}

// Pegasus fork (PEGA-170, Nachtrag 26.11.2026): like the Hub, the spec wins
// whenever the setup runs. A matched column gets the spec's name (a renamed
// stage keeps its slug and its cards), icon, done flag, phase, lock and
// restriction; changes made in the board's column settings stay until then.
// Retired columns are removed; the API keeps one that still holds cards and
// apply-action reports it. Columns outside the spec stay.
export function planColumns(specColumns, columns, retiredNames = []) {
  const actions = [];
  const warnings = [];
  const matched = new Set();

  for (const spec of specColumns) {
    const { formerName, ...wanted } = spec;
    const column = matchColumn(spec, columns);
    if (!column) {
      actions.push({ type: "create-column", column: wanted });
      continue;
    }
    matched.add(column.id);

    const settings = {
      name: spec.name,
      icon: spec.icon ?? null,
      isFinal: spec.isFinal ?? false,
      phase: spec.phase ?? null,
      isLocked: spec.isLocked ?? false,
      isRestricted: spec.isRestricted ?? false,
    };
    const current = {
      name: column.name,
      icon: column.icon ?? null,
      isFinal: column.isFinal ?? false,
      phase: column.phase ?? null,
      isLocked: column.isLocked ?? false,
      isRestricted: column.isRestricted ?? false,
    };
    const changes = Object.fromEntries(
      Object.entries(settings).filter(([key, value]) => current[key] !== value),
    );
    if (Object.keys(changes).length > 0) {
      actions.push({
        type: "update-column",
        id: column.id,
        name: column.name,
        changes,
      });
    }
  }

  const retired = new Set(
    retiredNames
      .map((name) => matchColumn({ name }, columns)?.id)
      .filter(Boolean),
  );
  for (const column of columns) {
    if (matched.has(column.id)) continue;
    if (DEFAULT_COLUMN_SLUGS.includes(column.slug) || retired.has(column.id)) {
      actions.push({ type: "delete-column", id: column.id, name: column.name });
    } else {
      warnings.push(
        `Spalte „${column.name}“ steht nicht in der Vorgabe und bleibt am Ende des Boards.`,
      );
    }
  }

  return { actions, warnings };
}

export function wantedColumnIds(specColumns, columns) {
  return specColumns
    .map((spec) => matchColumn(spec, columns)?.id)
    .filter(Boolean);
}
