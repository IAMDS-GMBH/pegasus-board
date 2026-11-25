// Pegasus fork (PEGA-66): the Hub sets a lead's deadline as the card's due
// date, to the minute, so a card is overdue as soon as that moment has passed.
// Upstream's chip counts calendar days instead; this rule decides the red
// card, the "Überfällig" filter and the start page block.
export function isTaskOverdue(
  task: { dueDate: string | null; status: string },
  isFinal: boolean,
  now: Date = new Date(),
): boolean {
  if (!task.dueDate || isFinal || task.status === "archived") return false;
  return new Date(task.dueDate).getTime() < now.getTime();
}
