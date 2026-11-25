import { describe, expect, it } from "vite-plus/test";
import { isTaskOverdue } from "./is-task-overdue";

// Pegasus fork (PEGA-66): the Hub sets a lead's deadline as the card's due
// date, to the minute. A card is overdue as soon as that moment has passed.
describe("isTaskOverdue", () => {
  const now = new Date("2026-11-25T12:00:00.000Z");
  const open = (dueDate: string | null, status = "unbearbeitet") => ({
    dueDate,
    status,
  });

  it("is overdue once the due moment has passed", () => {
    expect(isTaskOverdue(open("2026-11-25T11:59:00.000Z"), false, now)).toBe(
      true,
    );
  });

  it.each([
    ["the due moment is still ahead", open("2026-11-25T12:01:00.000Z"), false],
    ["the due moment is now", open("2026-11-25T12:00:00.000Z"), false],
    ["there is no due date", open(null), false],
    ["the column is final", open("2026-11-24T12:00:00.000Z"), true],
    [
      "the card is archived",
      open("2026-11-24T12:00:00.000Z", "archived"),
      false,
    ],
  ])("is not overdue when %s", (_case, task, isFinal) => {
    expect(isTaskOverdue(task, isFinal, now)).toBe(false);
  });
});
