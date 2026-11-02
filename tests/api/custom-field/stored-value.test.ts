import { describe, expect, it } from "vite-plus/test";
import { toStoredCustomFieldValue } from "../../../apps/api/src/custom-field/stored-value";

describe("toStoredCustomFieldValue", () => {
  it("rewrites url, email and phone values for storage and leaves text alone", () => {
    expect(toStoredCustomFieldValue("url", "example.org")).toBe(
      "https://example.org/",
    );
    // Pegasus fork (PEGA-86): contact values are trimmed for storage.
    expect(toStoredCustomFieldValue("email", " max@example.org ")).toBe(
      "max@example.org",
    );
    expect(toStoredCustomFieldValue("phone", " 0170  1234567 ")).toBe(
      "0170 1234567",
    );
    expect(toStoredCustomFieldValue("text", " example.org ")).toBe(
      " example.org ",
    );
  });

  it("keeps a value that does not fit its type, so validation can reject it", () => {
    expect(toStoredCustomFieldValue("phone", "keine Angabe")).toBe(
      "keine Angabe",
    );
  });
});
