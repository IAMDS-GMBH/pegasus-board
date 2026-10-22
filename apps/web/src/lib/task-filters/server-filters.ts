// Pegasus fork (PEGA-89): the subset of the board filters that the API can
// apply before pagination. Only positive label and custom field subjects
// qualify; everything else (status split, negation, due dates, text) stays in
// the client matcher, which also re-checks the rows the server returns.
import type { BoardFilters } from "@/hooks/use-task-filters";
import { customFieldSubjectId } from "./filter-subject-id";
import {
  type FilterLabel,
  groupLabels,
  isLabelGroupSelected,
} from "./label-groups";

export type TaskServerFilters = {
  labels?: string[];
  customFields?: Record<string, string[]>;
};

export function toServerFilters(
  filters: BoardFilters,
  labels: FilterLabel[],
): TaskServerFilters | null {
  const negated = new Set(filters.negated ?? []);
  const result: TaskServerFilters = {};

  if (filters.labels?.length && !negated.has("labels")) {
    // Labels are per-task copies, so the server matches by group name.
    const names = groupLabels(labels)
      .filter((group) => isLabelGroupSelected(labels, group, filters.labels))
      .map((group) => group.name);
    const unique = [...new Set(names)];
    if (unique.length) result.labels = unique;
  }

  for (const [fieldId, values] of Object.entries(filters.customFields ?? {})) {
    if (!values?.length || negated.has(customFieldSubjectId(fieldId))) continue;
    result.customFields = { ...result.customFields, [fieldId]: [...values] };
  }

  return result.labels || result.customFields ? result : null;
}

/** Stable key: equal filters serialize equally regardless of insertion order. */
export function serializeServerFilters(filters: TaskServerFilters | null) {
  if (!filters) return "";
  return JSON.stringify({
    labels: [...(filters.labels ?? [])].sort(),
    customFields: Object.keys(filters.customFields ?? {})
      .sort()
      .map((fieldId) => [
        fieldId,
        [...(filters.customFields?.[fieldId] ?? [])].sort(),
      ]),
  });
}
