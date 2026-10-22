import { describe, expect, it } from "vite-plus/test";
import type { BoardFilters } from "@/hooks/use-task-filters";
import { serializeServerFilters, toServerFilters } from "./server-filters";

const none: BoardFilters = {
  status: null,
  priority: null,
  assignee: null,
  dueDate: null,
  labels: null,
  customFields: null,
  negated: null,
};

const labels = [
  { id: "l1", name: "Kampagne A", color: "green" },
  { id: "l2", name: "Kampagne A", color: "green" },
  { id: "l3", name: "Meta", color: "blue" },
];

describe("toServerFilters", () => {
  it("returns null without label or custom field filters", () => {
    expect(toServerFilters(none, labels)).toBeNull();
    expect(
      toServerFilters(
        { ...none, status: ["todo"], priority: ["high"] },
        labels,
      ),
    ).toBeNull();
  });

  it("maps selected label ids to unique group names", () => {
    expect(
      toServerFilters({ ...none, labels: ["l1", "l2", "l3"] }, labels),
    ).toEqual({ labels: ["Kampagne A", "Meta"] });
  });

  it("sends no label filter while the label list is unknown", () => {
    expect(toServerFilters({ ...none, labels: ["l1"] }, [])).toBeNull();
  });

  it("passes custom field values through", () => {
    expect(
      toServerFilters(
        { ...none, customFields: { paket: ["P2", "P3"], empty: [] } },
        labels,
      ),
    ).toEqual({ customFields: { paket: ["P2", "P3"] } });
  });

  it("keeps negated subjects on the client", () => {
    expect(
      toServerFilters(
        {
          ...none,
          labels: ["l1"],
          customFields: { paket: ["P2"], plz: ["86000"] },
          negated: ["labels", "customField:paket"],
        },
        labels,
      ),
    ).toEqual({ customFields: { plz: ["86000"] } });
  });
});

describe("serializeServerFilters", () => {
  it("is empty for null", () => {
    expect(serializeServerFilters(null)).toBe("");
  });

  it("ignores ordering", () => {
    expect(
      serializeServerFilters({
        labels: ["b", "a"],
        customFields: { y: ["2", "1"], x: ["0"] },
      }),
    ).toBe(
      serializeServerFilters({
        customFields: { x: ["0"], y: ["1", "2"] },
        labels: ["a", "b"],
      }),
    );
  });

  it("distinguishes different filters", () => {
    expect(serializeServerFilters({ labels: ["a"] })).not.toBe(
      serializeServerFilters({ labels: ["b"] }),
    );
  });
});
