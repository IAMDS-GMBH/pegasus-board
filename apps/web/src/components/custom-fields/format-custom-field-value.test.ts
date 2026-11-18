import { describe, expect, it } from "vite-plus/test";
import { formatCustomFieldValue } from "./format-custom-field-value";

describe("formatCustomFieldValue", () => {
  it("returns null for empty values and booleans", () => {
    expect(formatCustomFieldValue("text", " ", "short")).toBeNull();
    expect(formatCustomFieldValue("multiselect", "[]", "short")).toBeNull();
    expect(formatCustomFieldValue("boolean", "true", "short")).toBeNull();
  });

  it("shows two options and counts the rest", () => {
    expect(
      formatCustomFieldValue("multiselect", '["Web","iOS","Android"]', "short"),
    ).toEqual({ text: "Web, iOS", more: 1 });
  });

  it("formats dates as local calendar days", () => {
    expect(formatCustomFieldValue("date", "2026-10-22", "short")?.text).toMatch(
      /22/,
    );
    expect(
      formatCustomFieldValue("date", "2026-10-22", "medium")?.text,
    ).toMatch(/2026/);
  });

  it("shows links without their scheme", () => {
    expect(
      formatCustomFieldValue("url", "https://linkedin.com/in/max", "short"),
    ).toEqual({ text: "linkedin.com/in/max", more: 0 });
  });

  it("keeps unparseable dates and plain values as typed", () => {
    expect(formatCustomFieldValue("date", "soon", "short")?.text).toBe("soon");
    expect(formatCustomFieldValue("number", "5", "short")).toEqual({
      text: "5",
      more: 0,
    });
  });

  // Pegasus fork (PEGA-123): the Hub's appointment, in German time.
  it("adds the time in Europe/Berlin when a date value has one", () => {
    const medium = formatCustomFieldValue(
      "date",
      "2026-10-28T12:00:00.000Z",
      "medium",
    )?.text;
    expect(medium).toMatch(/2026/);
    expect(medium).toMatch(/13:00|1:00\sPM/);
    expect(
      formatCustomFieldValue("date", "2026-07-01T10:00:00.000Z", "short")?.text,
    ).toMatch(/12:00|12:00\sPM/);
  });

  it("shows only the day for a date without a time", () => {
    expect(
      formatCustomFieldValue("date", "2026-10-28", "medium")?.text,
    ).not.toMatch(/:/);
  });
});
