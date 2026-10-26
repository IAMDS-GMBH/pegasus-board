// Returns the reorder payload when `current` (sorted by position) is not in the
// wanted order, otherwise null. Items missing from `wantedIds` keep their
// relative order after the wanted ones.
export function planOrder(wantedIds, current) {
  const wanted = wantedIds.filter((id) => current.some((c) => c.id === id));
  const rest = current.map((c) => c.id).filter((id) => !wanted.includes(id));
  const order = [...wanted, ...rest];

  const inOrder = order.every(
    (id, index) =>
      current[index]?.id === id && current[index].position === index,
  );
  return inOrder ? null : order.map((id, position) => ({ id, position }));
}
