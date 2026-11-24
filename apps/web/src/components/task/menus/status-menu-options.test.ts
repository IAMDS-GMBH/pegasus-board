import { describe, expect, it, vi } from "vite-plus/test";
import { statusMenuOptions } from "./status-menu-options";

vi.mock("@/lib/i18n/domain", () => ({
  getStatusDisplayLabel: (_slug: string, name: string) => name,
}));

const columns = [
  { slug: "eingang", name: "Eingang", isFinal: false, isLocked: true },
  {
    slug: "pegasus-pool",
    name: "Pegasus-Pool",
    isFinal: false,
    isLocked: true,
  },
  { slug: "unbearbeitet", name: "Unbearbeitet", isFinal: false },
  { slug: "in-kontakt", name: "In Kontakt", isFinal: false, isLocked: false },
];

const disabled = (options: ReturnType<typeof statusMenuOptions>) =>
  options.filter((option) => option.disabled).map((option) => option.value);

// Pegasus fork (PEGA-170): the status pickers offer no move into or out of a
// locked column to users the API would refuse.
describe("statusMenuOptions", () => {
  it("disables locked columns for users who may not move through them", () => {
    expect(disabled(statusMenuOptions(columns, "unbearbeitet", false))).toEqual(
      ["eingang", "pegasus-pool"],
    );
  });

  it("disables every other column while the card sits in a locked column", () => {
    expect(disabled(statusMenuOptions(columns, "eingang", false))).toEqual([
      "pegasus-pool",
      "unbearbeitet",
      "in-kontakt",
    ]);
  });

  it("disables nothing for users who may move through locked columns", () => {
    expect(disabled(statusMenuOptions(columns, "eingang", true))).toEqual([]);
    expect(disabled(statusMenuOptions(columns, "eingang"))).toEqual([]);
  });
});
