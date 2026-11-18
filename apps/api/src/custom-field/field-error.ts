import { ApiError } from "../errors/api-error";

// Pegasus fork (PEGA-90): stable codes so the web can show these errors in the
// user's language. The English message stays for API and MCP clients.
export type CustomFieldErrorCode =
  | "CUSTOM_FIELD_NAME_REQUIRED"
  | "CUSTOM_FIELD_INVALID_DEFAULT"
  | "CUSTOM_FIELD_TOO_FEW_OPTIONS"
  | "CUSTOM_FIELD_TYPE_LOCKED"
  | "CUSTOM_FIELD_OPTIONS_NOT_ALLOWED"
  | "CUSTOM_FIELD_OPTION_IN_USE"
  | "CUSTOM_FIELD_TASKS_HAVE_MULTIPLE_OPTIONS"
  // Pegasus fork (PEGA-86): a text field switching to email or phone.
  | "CUSTOM_FIELD_TASKS_HAVE_INVALID_VALUES"
  // Pegasus fork (PEGA-123): required fields need no default, but a value on
  // every task, and no task may lose it.
  | "CUSTOM_FIELD_REQUIRED_MISSING_VALUES"
  | "CUSTOM_FIELD_VALUE_REQUIRED";

export function fieldError(code: CustomFieldErrorCode, message: string): never {
  throw new ApiError(400, { code, message });
}
