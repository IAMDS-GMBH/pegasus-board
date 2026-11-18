import { describe, expect, it } from "vite-plus/test";
import {
  berlinDateTimeToIso,
  hasTime,
  isoToBerlinParts,
} from "./custom-field-date";

// Pegasus fork (PEGA-123): the Hub sends the appointment as UTC ISO 8601;
// people read and enter it in German time.
describe("hasTime", () => {
  it.each([
    ["2026-10-28", false],
    ["", false],
    ["2026-10-28T12:00:00.000Z", true],
    ["2026-10-28T12:00:00+01:00", true],
  ])("tells whether %j has a time", (value, expected) => {
    expect(hasTime(value)).toBe(expected);
  });
});

describe("berlinDateTimeToIso", () => {
  it.each([
    ["2026-10-28", "13:00", "2026-10-28T12:00:00.000Z"],
    ["2026-07-01", "12:00", "2026-07-01T10:00:00.000Z"],
    ["2026-03-29", "03:30", "2026-03-29T01:30:00.000Z"],
    ["2026-01-01", "00:15", "2025-12-31T23:15:00.000Z"],
  ])("turns %s %s in Berlin into %s", (date, time, iso) => {
    expect(berlinDateTimeToIso(date, time)).toBe(iso);
  });
});

describe("isoToBerlinParts", () => {
  it.each([
    ["2026-10-28T12:00:00.000Z", { date: "2026-10-28", time: "13:00" }],
    ["2026-07-01T10:00:00.000Z", { date: "2026-07-01", time: "12:00" }],
    ["2026-10-28T23:30:00.000Z", { date: "2026-10-29", time: "00:30" }],
    ["2026-10-28", { date: "2026-10-28", time: "" }],
  ])("reads %s as %j", (value, parts) => {
    expect(isoToBerlinParts(value)).toEqual(parts);
  });
});
