import { describe, expect, it } from "vite-plus/test";
import {
  customFieldPhoneHref,
  normalizeCustomFieldPhone,
} from "./custom-field-phone";

// Pegasus fork (PEGA-86): mirrors tests/api/custom-field/phone-value.test.ts.
describe("normalizeCustomFieldPhone", () => {
  it.each([
    ["+49 (0) 170 123-4567", "+49 (0) 170 123-4567"],
    ["0049 170/1234567", "0049 170/1234567"],
    ["  0170   1234567 ", "0170 1234567"],
  ])("normalizes %j", (input, expected) => {
    expect(normalizeCustomFieldPhone(input)).toBe(expected);
  });

  it.each([
    "",
    "keine Angabe",
    "1234",
    "0170 12345678901234",
    "0170+1234567",
    "tel:01701234567",
  ])("rejects %j", (input) => {
    expect(normalizeCustomFieldPhone(input)).toBeNull();
  });
});

describe("customFieldPhoneHref", () => {
  it.each([
    ["0170 1234567", "tel:01701234567"],
    ["+49 (0) 170 123-4567", "tel:+491701234567"],
    ["(089) 123 45-6", "tel:089123456"],
  ])("builds a tel: href from the digits of %j", (input, expected) => {
    expect(customFieldPhoneHref(input)).toBe(expected);
  });

  it("returns null for a value that is not a phone number", () => {
    expect(customFieldPhoneHref("keine Angabe")).toBeNull();
  });
});
