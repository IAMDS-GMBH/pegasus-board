// Sends one planned change to the Kaneo API. Returns the created or updated
// record, or a warning when the API refused a cleanup step.
export async function applyAction(client, action, { workspaceId, projectId }) {
  switch (action.type) {
    case "create-project":
      return client.post("/project", { ...action.project, workspaceId });
    case "create-column":
      return client.post(`/column/${projectId}`, action.column);
    case "update-column":
      return client.put(`/column/${action.id}`, action.changes);
    case "delete-column":
      try {
        return await client.delete(`/column/${action.id}`);
      } catch (error) {
        // 409: the column still holds cards and has to be emptied by hand.
        if (error.status !== 409) throw error;
        return {
          warning: `Spalte „${action.name}“ enthält noch Karten und bleibt bestehen.`,
        };
      }
    case "reorder-column":
      return client.put(`/column/reorder/${projectId}`, {
        columns: action.order,
      });
    case "create-label":
      return client.post("/label", { ...action.label, workspaceId });
    case "update-label":
      return client.put(`/label/${action.id}`, {
        name: action.name,
        ...action.changes,
      });
    case "create-field":
      return client.post("/custom-field", {
        projectId,
        name: action.field.name,
        type: action.field.type,
        required: false,
        options: action.field.options,
        showOnCard: action.field.showOnCard ?? false,
      });
    case "update-field":
      return client.put(`/custom-field/${action.id}`, action.changes);
    case "reorder-field":
      return client.put(`/custom-field/reorder/${projectId}`, {
        fields: action.order,
      });
    default:
      throw new Error(`Unbekannte Aktion ${action.type}`);
  }
}
