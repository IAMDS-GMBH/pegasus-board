import { describe, expect, it } from "vite-plus/test";
import { groupColumnsByPhase } from "./group-columns-by-phase";

const column = (id: string, phase: string | null) => ({ id, phase });

// Pegasus fork (PEGA-170): the board shows neighbouring columns of one phase
// under a shared heading.
describe("groupColumnsByPhase", () => {
  it("groups adjacent columns with the same phase", () => {
    const columns = [
      column("eingang", "Eingang"),
      column("pool", "Eingang"),
      column("nicht-erreicht", "Kontakt"),
    ];

    expect(groupColumnsByPhase(columns)).toEqual([
      { phase: "Eingang", columns: [columns[0], columns[1]] },
      { phase: "Kontakt", columns: [columns[2]] },
    ]);
  });

  it("leaves columns without a phase ungrouped", () => {
    const columns = [
      column("a", null),
      column("b", null),
      column("c", "Kontakt"),
    ];

    expect(groupColumnsByPhase(columns)).toEqual([
      { phase: null, columns: [columns[0]] },
      { phase: null, columns: [columns[1]] },
      { phase: "Kontakt", columns: [columns[2]] },
    ]);
  });

  it("repeats a phase that another column splits", () => {
    const columns = [
      column("a", "Kontakt"),
      column("b", null),
      column("c", "Kontakt"),
    ];

    expect(groupColumnsByPhase(columns).map((group) => group.phase)).toEqual([
      "Kontakt",
      null,
      "Kontakt",
    ]);
  });

  it("treats a column without the field as without phase", () => {
    const columns: { id: string; phase?: string | null }[] = [{ id: "a" }];

    expect(groupColumnsByPhase(columns)).toEqual([
      { phase: null, columns: [{ id: "a" }] },
    ]);
  });
});
