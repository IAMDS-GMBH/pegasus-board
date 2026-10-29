import { describe, expect, it } from "vite-plus/test";
import { normalizeEmailValue } from "../../../apps/api/src/custom-field/email-value";

// Pegasus fork (PEGA-86): the `email` custom field type.
describe("normalizeEmailValue", () => {
  it.each([
    ["max@example.org", "max@example.org"],
    [
      "  max.mustermann+pool@mail.example.de ",
      "max.mustermann+pool@mail.example.de",
    ],
  ])("normalizes %j", (input, expected) => {
    expect(normalizeEmailValue(input)).toBe(expected);
  });

  it.each([
    "",
    "max",
    "max@host",
    "max mustermann@example.org",
    "max@example.org?cc=boss@example.org",
    "max@example.org&body=x",
    "max@b@example.org",
    "mailto:max@example.org",
    "<max@example.org>",
    `${"a".repeat(250)}@example.org`,
  ])("rejects %j", (input) => {
    expect(normalizeEmailValue(input)).toBeNull();
  });
});
