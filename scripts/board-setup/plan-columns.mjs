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

export function matchColumn(spec, columns) {
  const slug = toSlug(spec.name);
  return (
    columns.find((c) => c.slug === slug) ??
    columns.find((c) => c.name === spec.name)
  );
}

export function planColumns(specColumns, columns) {
  const actions = [];
  const warnings = [];
  const matched = new Set();

  for (const spec of specColumns) {
    const column = matchColumn(spec, columns);
    if (!column) {
      actions.push({ type: "create-column", column: spec });
      continue;
    }
    matched.add(column.id);

    const changes = {};
    if (column.name !== spec.name) changes.name = spec.name;
    if ((column.icon ?? null) !== (spec.icon ?? null)) {
      changes.icon = spec.icon ?? null;
    }
    if (column.isFinal !== (spec.isFinal ?? false)) {
      changes.isFinal = spec.isFinal ?? false;
    }
    if (Object.keys(changes).length > 0) {
      actions.push({
        type: "update-column",
        id: column.id,
        name: column.name,
        changes,
      });
    }
  }

  for (const column of columns) {
    if (matched.has(column.id)) continue;
    if (DEFAULT_COLUMN_SLUGS.includes(column.slug)) {
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
