import { describe, expect, it } from "vite-plus/test";
import { normalizeCustomFieldEmail } from "./custom-field-email";

// Pegasus fork (PEGA-86): mirrors tests/api/custom-field/email-value.test.ts.
describe("normalizeCustomFieldEmail", () => {
  it("trims an email address", () => {
    expect(normalizeCustomFieldEmail("  max@example.org ")).toBe(
      "max@example.org",
    );
  });

  it.each([
    "",
    "max",
    "max@host",
    "max mustermann@example.org",
    "max@example.org?cc=boss@example.org",
    "max@b@example.org",
    "mailto:max@example.org",
    `${"a".repeat(250)}@example.org`,
  ])("rejects %j", (input) => {
    expect(normalizeCustomFieldEmail(input)).toBeNull();
  });
});
