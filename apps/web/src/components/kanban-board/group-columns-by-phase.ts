export type PhaseGroup<T> = { phase: string | null; columns: T[] };

// Pegasus fork (PEGA-170): neighbouring columns of one phase share a heading.
// Columns without a phase stand alone; a phase another column splits shows
// twice, which keeps reordering columns simple.
export function groupColumnsByPhase<T extends { phase?: string | null }>(
  columns: readonly T[],
): PhaseGroup<T>[] {
  const groups: PhaseGroup<T>[] = [];
  for (const column of columns) {
    const phase = column.phase ?? null;
    const last = groups.at(-1);
    if (phase !== null && last?.phase === phase) {
      last.columns.push(column);
    } else {
      groups.push({ phase, columns: [column] });
    }
  }
  return groups;
}
