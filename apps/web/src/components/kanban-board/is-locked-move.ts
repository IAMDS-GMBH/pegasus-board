type LockableColumn = { id: string; isLocked?: boolean };

// Pegasus fork (PEGA-170): whether a move takes a card into or out of a locked
// column the user may not move through. Same column is a reorder, never locked.
export function isLockedMove(
  from: LockableColumn | undefined,
  to: LockableColumn | undefined,
  canMoveLocked: boolean,
): boolean {
  if (canMoveLocked || from?.id === to?.id) return false;
  return Boolean(from?.isLocked || to?.isLocked);
}
