import { describe, expect, it } from "vite-plus/test";
import { reminderEventId } from "../../../apps/api/src/scheduler/reminder-event-id";

const input = {
  reminderType: "generic_webhook:integration-1",
  taskId: "task-1",
  dueDate: new Date("2026-09-23T00:00:00.000Z"),
  leadTimeMinutes: 1440,
};

describe("reminderEventId", () => {
  it("returns the same UUID for a re-sent reminder", () => {
    const id = reminderEventId(input);

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(reminderEventId({ ...input })).toBe(id);
  });

  it("differs for another task or due date", () => {
    const id = reminderEventId(input);

    expect(reminderEventId({ ...input, taskId: "task-2" })).not.toBe(id);
    expect(
      reminderEventId({
        ...input,
        dueDate: new Date("2026-09-24T00:00:00.000Z"),
      }),
    ).not.toBe(id);
  });
});
