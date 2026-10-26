// Workspace labels are the rows without a task; attaching a label to a card
// copies it, and the API matches those copies by name.
export function planLabels(specLabels, labels) {
  const workspaceLabels = labels.filter((l) => l.taskId === null);
  const actions = [];
  const warnings = [];

  for (const spec of specLabels) {
    const label = workspaceLabels.find((l) => l.name === spec.name);
    if (!label) {
      actions.push({ type: "create-label", label: spec });
    } else if (label.deletionStartedAt) {
      warnings.push(
        `Label „${spec.name}“ wird gerade gelöscht; bitte nach dem Löschen erneut ausführen.`,
      );
    } else if (label.color !== spec.color) {
      actions.push({
        type: "update-label",
        id: label.id,
        name: spec.name,
        changes: { color: spec.color },
      });
    }
  }

  return { actions, warnings };
}
