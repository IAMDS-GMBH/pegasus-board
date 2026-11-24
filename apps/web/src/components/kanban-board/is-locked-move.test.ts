import { describe, expect, it } from "vite-plus/test";
import { isLockedMove } from "./is-locked-move";

const eingang = { id: "eingang", isLocked: true };
const pool = { id: "pegasus-pool", isLocked: true };
const unbearbeitet = { id: "unbearbeitet", isLocked: false };

// Pegasus fork (PEGA-170): members may not move cards into or out of a locked
// column; the API enforces it, the board only spares them the failed drop.
describe("isLockedMove", () => {
  it("blocks a move out of a locked column", () => {
    expect(isLockedMove(eingang, unbearbeitet, false)).toBe(true);
  });

  it("blocks a move into a locked column", () => {
    expect(isLockedMove(unbearbeitet, pool, false)).toBe(true);
    expect(isLockedMove(eingang, pool, false)).toBe(true);
  });

  it("allows a move within the same column", () => {
    expect(isLockedMove(eingang, eingang, false)).toBe(false);
  });

  it("allows moves between unlocked columns and every move for exempt users", () => {
    expect(
      isLockedMove(unbearbeitet, { id: "x", isLocked: false }, false),
    ).toBe(false);
    expect(isLockedMove(eingang, unbearbeitet, true)).toBe(false);
  });

  it("treats a missing column as unlocked", () => {
    expect(isLockedMove(undefined, unbearbeitet, false)).toBe(false);
  });
});
