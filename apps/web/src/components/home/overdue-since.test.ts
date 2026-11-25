import { describe, expect, it } from "vite-plus/test";
import { overdueSince } from "./overdue-since";

// Pegasus fork (PEGA-66): the Hub's deadline runs 48 hours, so the start page
// counts minutes and hours first and days only after that.
describe("overdueSince", () => {
  const now = new Date("2026-11-25T12:00:00.000Z");
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;

  it.each([
    [ago(20 * 1000), { unit: "minutes", count: 1 }],
    [ago(25 * MINUTE), { unit: "minutes", count: 25 }],
    [ago(HOUR), { unit: "hours", count: 1 }],
    [ago(47 * HOUR + 59 * MINUTE), { unit: "hours", count: 47 }],
    [ago(48 * HOUR), { unit: "days", count: 2 }],
    [ago(10 * 24 * HOUR), { unit: "days", count: 10 }],
  ])("counts %s as %o", (dueDate, expected) => {
    expect(overdueSince(dueDate, now)).toEqual(expected);
  });
});
