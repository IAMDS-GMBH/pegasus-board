// Pegasus fork (PEGA-89): deterministic lead cards for the filter tests and
// the dev seed. Card i is fully determined by its index, so a test can compute
// the expected result of any filter without reading the database.

export type CardFieldType = "dropdown" | "text" | "multiselect";

export type CardFieldSpec = {
  name: string;
  type: CardFieldType;
  options: string[] | null;
  valueFor: (index: number) => string;
};

export const CARD_FIELDS: readonly CardFieldSpec[] = [
  {
    name: "Paket",
    type: "dropdown",
    options: ["P1", "P2", "P3"],
    valueFor: (index) => `P${(index % 3) + 1}`,
  },
  {
    name: "PLZ",
    type: "text",
    options: null,
    valueFor: (index) => String(86000 + index),
  },
  {
    name: "Quelle",
    type: "multiselect",
    options: ["Meta", "LinkedIn", "Formular"],
    valueFor: (index) =>
      JSON.stringify(index % 2 === 0 ? ["Meta"] : ["LinkedIn", "Formular"]),
  },
];

export const CARD_LABEL = { name: "Kampagne A", color: "#009036" } as const;

export type GeneratedCard = {
  index: number;
  title: string;
  columnIndex: number;
  labeled: boolean;
  values: Record<string, string>;
};

export function hasCardLabel(index: number) {
  return index % 2 === 0;
}

export function cardAt(
  index: number,
  columnCount: number,
  prefix = "Karte",
): GeneratedCard {
  return {
    index,
    title: `${prefix} ${index}`,
    columnIndex: index % Math.max(1, columnCount),
    labeled: hasCardLabel(index),
    values: Object.fromEntries(
      CARD_FIELDS.map((field) => [field.name, field.valueFor(index)]),
    ),
  };
}

export function generateCards(
  count: number,
  columnCount: number,
  prefix = "Karte",
): GeneratedCard[] {
  return Array.from({ length: count }, (_, index) =>
    cardAt(index, columnCount, prefix),
  );
}
