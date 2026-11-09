import { describe, expect, it } from "vite-plus/test";
import { composeTaskScope } from "../../../apps/api/src/task-scope/compose-task-scope";

// Pegasus fork (PEGA-141, PEGA-142): how the board's own "assigned only"
// restriction and the scope pushed by the Hub combine into what a member may
// see. Once the Hub manages a workspace, its scope applies to every member and
// "assigned only" narrows it further.

const userId = "user-1";

describe("composeTaskScope", () => {
  it("leaves a member of a workspace the Hub does not manage unrestricted", () => {
    expect(
      composeTaskScope({
        userId,
        assignedOnly: false,
        managed: false,
        hub: { mode: "units", unitIds: ["U3"] },
      }),
    ).toBeNull();
  });

  it("restricts an assigned-only member of an unmanaged workspace to their own tasks", () => {
    expect(
      composeTaskScope({
        userId,
        assignedOnly: true,
        managed: false,
        hub: null,
      }),
    ).toEqual({ userId, assignedOnly: true, unitIds: null });
  });

  it.each([
    ["all", [], null],
    [
      "units",
      ["U3", "U6"],
      { userId, assignedOnly: false, unitIds: ["U3", "U6"] },
    ],
    ["assigned", [], { userId, assignedOnly: true, unitIds: null }],
  ] as const)("maps the hub mode %s", (mode, unitIds, expected) => {
    expect(
      composeTaskScope({
        userId,
        assignedOnly: false,
        managed: true,
        hub: { mode, unitIds },
      }),
    ).toEqual(expected);
  });

  it("hides everything from a member the Hub did not send, even assigned tasks", () => {
    for (const assignedOnly of [false, true]) {
      expect(
        composeTaskScope({ userId, assignedOnly, managed: true, hub: null }),
      ).toEqual({ userId, assignedOnly, unitIds: [] });
    }
  });

  it.each([
    ["units", ["U3"], { userId, assignedOnly: true, unitIds: ["U3"] }],
    ["all", [], { userId, assignedOnly: true, unitIds: null }],
    ["assigned", [], { userId, assignedOnly: true, unitIds: null }],
  ] as const)(
    "narrows the hub mode %s further with assigned-only",
    (mode, unitIds, expected) => {
      expect(
        composeTaskScope({
          userId,
          assignedOnly: true,
          managed: true,
          hub: { mode, unitIds },
        }),
      ).toEqual(expected);
    },
  );
});
