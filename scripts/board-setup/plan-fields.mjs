// Types the API can switch into each other (PUT /api/custom-field/{id});
// every other type change is rejected. Text to email or phone (PEGA-86) is
// rejected too while a card holds a value that doesn't fit.
const CONVERTIBLE_GROUPS = [
  ["dropdown", "multiselect"],
  ["text", "email", "phone"],
];

function canConvert(from, to) {
  return CONVERTIBLE_GROUPS.some(
    (group) => group.includes(from) && group.includes(to),
  );
}

export function matchField(spec, fields) {
  return fields.find((f) => f.name === spec.name);
}

export function planFields(specFields, fields) {
  const actions = [];
  const warnings = [];
  const errors = [];

  for (const spec of specFields) {
    const field = matchField(spec, fields);
    if (!field) {
      actions.push({ type: "create-field", field: spec });
      continue;
    }

    const changes = {};
    if (field.type !== spec.type) {
      if (canConvert(field.type, spec.type)) {
        changes.type = spec.type;
      } else {
        errors.push(
          `Feld „${spec.name}“ hat den Typ ${field.type}, die Vorgabe verlangt ${spec.type}. Die API erlaubt diesen Typwechsel nicht; das Feld muss von Hand gelöscht und neu angelegt werden.`,
        );
        continue;
      }
    }
    if (field.required) changes.required = false;
    if (field.showOnCard !== (spec.showOnCard ?? false)) {
      changes.showOnCard = spec.showOnCard ?? false;
    }

    // Options are only ever added: removing one that a card still uses is
    // rejected by the API, and silently dropping values is never wanted.
    const options = Array.isArray(field.options) ? field.options : [];
    const missing = (spec.options ?? []).filter((o) => !options.includes(o));
    if (missing.length > 0) changes.options = [...options, ...missing];
    const surplus = options.filter((o) => !(spec.options ?? []).includes(o));
    if (surplus.length > 0) {
      warnings.push(
        `Feld „${spec.name}“ hat zusätzliche Auswahlwerte (${surplus.join(", ")}); sie bleiben erhalten.`,
      );
    }

    if (Object.keys(changes).length > 0) {
      actions.push({
        type: "update-field",
        id: field.id,
        name: field.name,
        changes,
      });
    }
  }

  for (const field of fields) {
    if (!matchField(field, specFields)) {
      warnings.push(
        `Feld „${field.name}“ steht nicht in der Vorgabe und bleibt nach den Standardfeldern.`,
      );
    }
  }

  return { actions, warnings, errors };
}

export function wantedFieldIds(specFields, fields) {
  return specFields.map((spec) => matchField(spec, fields)?.id).filter(Boolean);
}
