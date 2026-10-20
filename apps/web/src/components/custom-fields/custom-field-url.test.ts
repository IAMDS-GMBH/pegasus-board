import { describe, expect, it } from "vite-plus/test";
import {
  customFieldUrlLabel,
  normalizeCustomFieldUrl,
} from "./custom-field-url";

describe("normalizeCustomFieldUrl", () => {
  it.each([
    ["linkedin.com/in/max", "https://linkedin.com/in/max"],
    ["  https://www.linkedin.com/in/max  ", "https://www.linkedin.com/in/max"],
    ["HTTPS://Example.ORG", "https://example.org/"],
    ["http://localhost:5173/x", "http://localhost:5173/x"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeCustomFieldUrl(input)).toBe(expected);
  });

  it.each([
    "",
    "asdf",
    "javascript:alert(1)",
    "mailto:max@example.org",
    "ftp://example.org/file",
    "https://user:secret@example.org",
    "https://example.org/a b",
  ])("rejects %j", (input) => {
    expect(normalizeCustomFieldUrl(input)).toBeNull();
  });
});

describe("customFieldUrlLabel", () => {
  it("drops the scheme and a trailing slash", () => {
    expect(customFieldUrlLabel("https://linkedin.com/in/max/")).toBe(
      "linkedin.com/in/max",
    );
    expect(customFieldUrlLabel("http://example.org/a?b=1")).toBe(
      "example.org/a?b=1",
    );
  });
});
