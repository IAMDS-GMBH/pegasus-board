const SUBJECTS = {
  project: "Projekt",
  column: "Spalte",
  label: "Label",
  field: "Feld",
};

// One output line per planned change, e.g. `+ Spalte „Eingang“`.
export function describeAction(action) {
  const [verb, kind] = action.type.split("-");
  const subject = SUBJECTS[kind];

  if (verb === "create") {
    const name = action[kind].name;
    return `+ ${subject} „${name}“ anlegen`;
  }
  if (verb === "update") {
    const keys = Object.keys(action.changes).join(", ");
    return `~ ${subject} „${action.name}“ ändern (${keys})`;
  }
  if (verb === "delete") return `- ${subject} „${action.name}“ entfernen`;
  if (verb === "reorder")
    return `↕ Reihenfolge der ${subject === "Feld" ? "Felder" : "Spalten"} anpassen`;
  return action.type;
}
