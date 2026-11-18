// Pegasus fork (PEGA-90): maps the API's custom field error codes to texts in
// the user's language. Anything else gets the caller's translated fallback,
// so English API messages never reach the field management.
import { HttpError } from "@/lib/http-error";

const keys: Record<string, string> = {
  CUSTOM_FIELD_NAME_REQUIRED: "settings:customFields.errors.nameRequired",
  CUSTOM_FIELD_INVALID_DEFAULT: "settings:customFields.errors.invalidDefault",
  CUSTOM_FIELD_TOO_FEW_OPTIONS: "settings:customFields.errors.tooFewOptions",
  CUSTOM_FIELD_TYPE_LOCKED: "settings:customFields.errors.typeLocked",
  CUSTOM_FIELD_OPTIONS_NOT_ALLOWED:
    "settings:customFields.errors.optionsNotAllowed",
  CUSTOM_FIELD_OPTION_IN_USE: "settings:customFields.errors.optionInUse",
  CUSTOM_FIELD_TASKS_HAVE_MULTIPLE_OPTIONS:
    "settings:customFields.errors.tasksHaveMultipleOptions",
  // Pegasus fork (PEGA-86): a text field switching to email or phone.
  CUSTOM_FIELD_TASKS_HAVE_INVALID_VALUES:
    "settings:customFields.errors.tasksHaveInvalidValues",
  // Pegasus fork (PEGA-123): required fields without a default, Hub fields.
  CUSTOM_FIELD_REQUIRED_MISSING_VALUES:
    "settings:customFields.errors.requiredMissingValues",
  CUSTOM_FIELD_VALUE_REQUIRED: "settings:customFields.errors.valueRequired",
  HUB_DEFINED_FIELD: "settings:customFields.errors.hubDefined",
  HUB_MANAGED_FIELD: "settings:customFields.errors.hubManaged",
  NOT_FOUND: "settings:customFields.errors.notFound",
};

export function customFieldErrorKey(error: unknown): string | null {
  return (error instanceof HttpError && error.code && keys[error.code]) || null;
}
