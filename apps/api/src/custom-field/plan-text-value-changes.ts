// Pegasus fork (PEGA-86): text, email and phone fields can switch into each
// other, so a board that started with plain text fields can turn them into
// links without losing card values.
import { normalizeEmailValue } from "./email-value";
import { fieldError } from "./field-error";
import { normalizePhoneValue } from "./phone-value";
import type { ChoiceValueChange } from "./plan-choice-value-changes";

const CONTACT_TYPES: Record<
  string,
  { normalize: (value: string) => string | null; misfit: string }
> = {
  email: {
    normalize: normalizeEmailValue,
    misfit: "Some tasks have a value that isn't an email address.",
  },
  phone: {
    normalize: normalizePhoneValue,
    misfit: "Some tasks have a value that isn't a phone number.",
  },
};

type PlanInput = {
  values: Array<string | null>;
  to: string;
};

/**
 * The value rewrites a switch to `to` needs. Rejects the switch when a task
 * holds a value the new type can't store; switching to text keeps every value.
 */
export function planTextValueChanges({
  values,
  to,
}: PlanInput): ChoiceValueChange[] {
  const contact = CONTACT_TYPES[to];
  if (!contact) return [];

  const changes: ChoiceValueChange[] = [];
  for (const value of new Set(values)) {
    if (!value) continue;

    const stored = contact.normalize(value);
    if (stored === null) {
      fieldError(
        "CUSTOM_FIELD_TASKS_HAVE_INVALID_VALUES",
        `${contact.misfit} Correct or clear those values first.`,
      );
    }
    if (stored !== value) changes.push({ from: value, to: stored });
  }

  return changes;
}
