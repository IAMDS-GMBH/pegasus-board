import { describe, expect, it } from "vite-plus/test";
import { groupFieldsBySection } from "./group-fields-by-section";

// Pegasus fork (PEGA-123): the detail view groups fields by `section`.
describe("groupFieldsBySection", () => {
  const field = (name: string, position: number, section?: string | null) => ({
    name,
    position,
    section,
  });

  it("orders groups by their first field and keeps positions inside", () => {
    const groups = groupFieldsBySection([
      field("Branche", 3, "Versicherungstechnisch"),
      field("Vorname", 1, "Stammdaten"),
      field("Ort", 4, "Stammdaten"),
      field("Anrede", 0, "Stammdaten"),
      field("Pegasus-ID", 2, "Versicherungstechnisch"),
    ]);

    expect(
      groups.map((group) => [group.section, group.fields.map((f) => f.name)]),
    ).toEqual([
      ["Stammdaten", ["Anrede", "Vorname", "Ort"]],
      ["Versicherungstechnisch", ["Pegasus-ID", "Branche"]],
    ]);
  });

  it("puts fields without a section last, in one group without a name", () => {
    const groups = groupFieldsBySection([
      field("Notiz", 0, null),
      field("Termin", 2, "Termin"),
      field("Intern", 1),
      field("Leer", 3, ""),
    ]);

    expect(
      groups.map((group) => [group.section, group.fields.map((f) => f.name)]),
    ).toEqual([
      ["Termin", ["Termin"]],
      [null, ["Notiz", "Intern", "Leer"]],
    ]);
  });

  it("returns no groups for no fields", () => {
    expect(groupFieldsBySection([])).toEqual([]);
  });
});
