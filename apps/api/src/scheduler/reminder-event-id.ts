import { createHash } from "node:crypto";

// Deterministic so a reminder re-sent after a failed delivery keeps its ID.
export function reminderEventId(input: {
  reminderType: string;
  taskId: string;
  dueDate: Date;
  leadTimeMinutes: number;
}): string {
  const hex = createHash("sha256")
    .update(
      [
        input.reminderType,
        input.taskId,
        input.dueDate.toISOString(),
        input.leadTimeMinutes,
      ].join("\n"),
    )
    .digest("hex");
  const variant = ((Number.parseInt(hex[16] ?? "0", 16) & 0x3) | 0x8).toString(
    16,
  );

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `8${hex.slice(13, 16)}`,
    `${variant}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}
