import { describe, expect, it } from "vite-plus/test";
import { customFieldHref } from "./custom-field-href";

describe("customFieldHref", () => {
  it("links url values to a new tab", () => {
    expect(customFieldHref("url", "linkedin.com/in/max")).toEqual({
      href: "https://linkedin.com/in/max",
      external: true,
    });
  });

  // Pegasus fork (PEGA-86): one tap calls or writes, mainly on a phone.
  it("links email values with mailto: and phone values with tel: in the same tab", () => {
    expect(customFieldHref("email", "max@example.org")).toEqual({
      href: "mailto:max@example.org",
      external: false,
    });
    expect(customFieldHref("phone", "+49 (0) 170 123-4567")).toEqual({
      href: "tel:+491701234567",
      external: false,
    });
  });

  it.each([
    ["text", "max@example.org"],
    ["number", "01701234567"],
    ["url", "javascript:alert(1)"],
    ["email", "max@example.org?bcc=x@y.de"],
    ["phone", "keine Angabe"],
  ] as const)("returns null for a %s value %j", (type, value) => {
    expect(customFieldHref(type, value)).toBeNull();
  });
});
