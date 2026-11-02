import { describe, expect, it } from "vite-plus/test";
import { normalizePhoneValue } from "../../../apps/api/src/custom-field/phone-value";

// Pegasus fork (PEGA-86): the `phone` custom field type.
describe("normalizePhoneValue", () => {
  it.each([
    ["0170 1234567", "0170 1234567"],
    ["+49 170 1234567", "+49 170 1234567"],
    ["+49 (0) 170 123-4567", "+49 (0) 170 123-4567"],
    ["0049 170/1234567", "0049 170/1234567"],
    ["089.12345", "089.12345"],
    ["  0170   1234567 ", "0170 1234567"],
  ])("normalizes %j", (input, expected) => {
    expect(normalizePhoneValue(input)).toBe(expected);
  });

  it.each([
    "",
    "keine Angabe",
    "1234",
    "0170 12345678901234",
    "0170+1234567",
    "tel:01701234567",
    "0170 1234567 ab 18 Uhr",
  ])("rejects %j", (input) => {
    expect(normalizePhoneValue(input)).toBeNull();
  });
});
