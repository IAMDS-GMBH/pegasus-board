// Pegasus fork (PEGA-123): groups in the order of their first field; fields
// without a section come last in a group without a heading.
type Groupable = { position: number; section?: string | null };

export type FieldGroup<T> = { section: string | null; fields: T[] };

export function groupFieldsBySection<T extends Groupable>(
  fields: T[],
): FieldGroup<T>[] {
  const sorted = [...fields].sort((a, b) => a.position - b.position);
  const groups = new Map<string | null, T[]>();

  for (const field of sorted) {
    const section = field.section?.trim() || null;
    groups.set(section, [...(groups.get(section) ?? []), field]);
  }

  const named = [...groups].filter(([section]) => section !== null);
  const unnamed = groups.get(null);
  return [
    ...named.map(([section, groupFields]) => ({
      section,
      fields: groupFields,
    })),
    ...(unnamed ? [{ section: null, fields: unnamed }] : []),
  ];
}
