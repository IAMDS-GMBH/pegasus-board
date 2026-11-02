import { describe, expect, it } from "vite-plus/test";
import { planTextValueChanges } from "../../../apps/api/src/custom-field/plan-text-value-changes";

// Pegasus fork (PEGA-86): text, email and phone fields switch into each other.
describe("planTextValueChanges", () => {
  it("returns only values whose stored form changes", () => {
    expect(
      planTextValueChanges({
        values: ["0170  1234567", "089 12345", "0170  1234567", "", null],
        to: "phone",
      }),
    ).toEqual([{ from: "0170  1234567", to: "0170 1234567" }]);
  });

  it.each([
    [
      "email",
      "max(at)example.org",
      "Some tasks have a value that isn't an email address.",
    ],
    [
      "phone",
      "keine Angabe",
      "Some tasks have a value that isn't a phone number.",
    ],
  ])(
    "rejects switching to %s while a task has a value that does not fit",
    (to, value, message) => {
      expect(() => planTextValueChanges({ values: [value], to })).toThrow(
        message,
      );
    },
  );

  it("accepts any value when switching back to text", () => {
    expect(
      planTextValueChanges({ values: ["keine Angabe", " x "], to: "text" }),
    ).toEqual([]);
  });
});
