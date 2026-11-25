// Pegasus fork (PEGA-66): how long a card has been overdue, in the unit the
// start page shows. The Hub's deadline runs 48 hours, so days start there.
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export type OverdueSince = {
  unit: "minutes" | "hours" | "days";
  count: number;
};

export function overdueSince(
  dueDate: string,
  now: Date = new Date(),
): OverdueSince {
  const elapsed = now.getTime() - new Date(dueDate).getTime();
  if (elapsed < HOUR_MS) {
    return {
      unit: "minutes",
      count: Math.max(1, Math.floor(elapsed / MINUTE_MS)),
    };
  }
  if (elapsed < 2 * DAY_MS) {
    return { unit: "hours", count: Math.floor(elapsed / HOUR_MS) };
  }
  return { unit: "days", count: Math.floor(elapsed / DAY_MS) };
}
