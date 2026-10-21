export function focusTaskElement(
  taskId: string,
  moveFocus: boolean,
  retry = true,
) {
  const element = document.querySelector<HTMLElement>(
    `[data-task-id="${taskId}"]`,
  );
  if (!element) {
    // Pegasus fork: a long board column renders the newly focused card only
    // after this keydown, so look again once React has painted it.
    if (retry)
      requestAnimationFrame(() => focusTaskElement(taskId, moveFocus, false));
    return;
  }
  if (moveFocus) element.focus({ preventScroll: true });
  element.scrollIntoView?.({ block: "nearest", inline: "nearest" });
}
