import { describe, expect, it } from "vite-plus/test";
import { composeTaskScope } from "../../../apps/api/src/task-scope/compose-task-scope";

// Pegasus fork (PEGA-141): how the two role restrictions and the scope pushed
// by the Hub combine into what a member may see.

const userId = "user-1";

describe("composeTaskScope", () => {
  it("leaves a member without restrictions unrestricted", () => {
    expect(
      composeTaskScope({
        userId,
        assignedOnly: false,
        hubScoped: false,
        hub: { mode: "units", unitIds: ["U3"] },
      }),
    ).toBeNull();
  });

  it("restricts an assigned-only member to their own tasks", () => {
    expect(
      composeTaskScope({
        userId,
        assignedOnly: true,
        hubScoped: false,
        hub: null,
      }),
    ).toEqual({ userId, assigned: true, unitIds: [] });
  });

  it.each([
    ["all", [], null],
    ["units", ["U3", "U6"], { userId, assigned: false, unitIds: ["U3", "U6"] }],
    ["assigned", [], { userId, assigned: true, unitIds: [] }],
  ] as const)("maps the hub mode %s", (mode, unitIds, expected) => {
    expect(
      composeTaskScope({
        userId,
        assignedOnly: false,
        hubScoped: true,
        hub: { mode, unitIds },
      }),
    ).toEqual(expected);
  });

  it("hides everything from a hub-scoped member the Hub did not send", () => {
    expect(
      composeTaskScope({
        userId,
        assignedOnly: false,
        hubScoped: true,
        hub: null,
      }),
    ).toEqual({ userId, assigned: false, unitIds: [] });
  });

  it("ignores a pushed scope when the role is not hub-scoped", () => {
    expect(
      composeTaskScope({
        userId,
        assignedOnly: true,
        hubScoped: false,
        hub: { mode: "all", unitIds: [] },
      }),
    ).toEqual({ userId, assigned: true, unitIds: [] });
  });

  it.each([
    ["units", ["U3"], { userId, assigned: true, unitIds: ["U3"] }],
    ["all", [], null],
    [null, [], { userId, assigned: true, unitIds: [] }],
  ] as const)(
    "admits a task when either restriction does (hub mode %s plus assigned-only)",
    (mode, unitIds, expected) => {
      expect(
        composeTaskScope({
          userId,
          assignedOnly: true,
          hubScoped: true,
          hub: mode ? { mode, unitIds } : null,
        }),
      ).toEqual(expected);
    },
  );
});
