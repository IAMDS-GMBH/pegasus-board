import { VIRTUAL_STATUSES } from "../task/validate-task-fields";

/** A column a request takes a card out of (`into: false`) or puts one into. */
export type TouchedColumn = { projectId: string; slug: string; into: boolean };

const isVirtual = (status: string) =>
  (VIRTUAL_STATUSES as readonly string[]).includes(status);

// Pegasus fork (PEGA-170): moving a card within a project touches both
// columns. Staying put touches none, and archiving or planning is no move:
// those statuses are no columns and follow their own rights.
export function columnChange(
  projectId: string,
  from: string | null,
  to: unknown,
): TouchedColumn[] {
  if (typeof to !== "string" || to === from || isVirtual(to)) return [];
  return [
    ...(from === null || isVirtual(from)
      ? []
      : [{ projectId, slug: from, into: false }]),
    { projectId, slug: to, into: true },
  ];
}
