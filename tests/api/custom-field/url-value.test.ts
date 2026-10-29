import { describe, expect, it } from "vite-plus/test";
import { normalizeUrlValue } from "../../../apps/api/src/custom-field/url-value";

describe("url custom field values", () => {
  it.each([
    ["linkedin.com/in/max", "https://linkedin.com/in/max"],
    ["  https://www.linkedin.com/in/max  ", "https://www.linkedin.com/in/max"],
    ["http://example.org/a?b=1#c", "http://example.org/a?b=1#c"],
    ["HTTPS://Example.ORG", "https://example.org/"],
    ["http://localhost:5173/x", "http://localhost:5173/x"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeUrlValue(input)).toBe(expected);
  });

  it.each([
    "",
    "asdf",
    "javascript:alert(1)",
    "data:text/html,<b>x</b>",
    "mailto:max@example.org",
    "ftp://example.org/file",
    "https://user:secret@example.org",
    "https://example.org/a b",
    `https://example.org/${"a".repeat(2048)}`,
  ])("rejects %j", (input) => {
    expect(normalizeUrlValue(input)).toBeNull();
  });
});
