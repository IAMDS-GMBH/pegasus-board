import {
  isCustomFieldValueEmpty,
  validateCustomFieldValue,
} from "../task/validate-task-fields";
import { fieldError } from "./field-error";

const NUMBER_PATTERN = /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i;

type CustomFieldDefinitionInput = {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string | null;
  options?: string[] | null;
};

function invalidDefault(message: string): never {
  fieldError("CUSTOM_FIELD_INVALID_DEFAULT", message);
}

function assertValidDefaultForType(
  trimmedValue: string,
  { name, type, options }: CustomFieldDefinitionInput,
) {
  if (type === "number") {
    const parsed = Number(trimmedValue);
    if (
      !NUMBER_PATTERN.test(trimmedValue) ||
      Number.isNaN(parsed) ||
      !Number.isFinite(parsed)
    ) {
      invalidDefault(
        "Default value must be a valid number for number type fields",
      );
    }
    return;
  }

  if (type === "boolean") {
    if (trimmedValue !== "true" && trimmedValue !== "false") {
      invalidDefault(
        "Default value must be 'true' or 'false' for boolean type fields",
      );
    }
    return;
  }

  if (type === "date") {
    const error = validateCustomFieldValue(trimmedValue, "date", name);
    if (error) invalidDefault(error);
    return;
  }

  if (type === "url" || type === "email" || type === "phone") {
    const error = validateCustomFieldValue(trimmedValue, type, name);
    if (error) invalidDefault(error);
    return;
  }

  if (type === "dropdown" && options && options.length > 0) {
    const normalizedOptions = options.map((option) => option.trim());
    if (!normalizedOptions.includes(trimmedValue)) {
      invalidDefault("Default value must be one of the dropdown options");
    }
  }
}

export function assertValidDefinition(input: CustomFieldDefinitionInput) {
  const { name, type, required, defaultValue, options } = input;

  if (required && (defaultValue == null || defaultValue.trim() === "")) {
    fieldError(
      "CUSTOM_FIELD_DEFAULT_REQUIRED",
      "Required fields must have a default value",
    );
  }

  const trimmedValue = defaultValue?.trim();
  if (trimmedValue) {
    assertValidDefaultForType(trimmedValue, input);
  }

  if (type === "dropdown" && (!options || options.length < 1)) {
    fieldError(
      "CUSTOM_FIELD_TOO_FEW_OPTIONS",
      "Dropdown fields must have at least one option",
    );
  }

  if (type === "multiselect") {
    const normalizedOptions = new Set(
      (options ?? []).map((option) => option.trim()).filter(Boolean),
    );
    if (normalizedOptions.size < 2) {
      fieldError(
        "CUSTOM_FIELD_TOO_FEW_OPTIONS",
        "Multiselect fields must have at least 2 options",
      );
    }
  }

  if (type === "multiselect" && defaultValue != null) {
    const empty = isCustomFieldValueEmpty(defaultValue, "multiselect");
    if (required && empty) {
      fieldError(
        "CUSTOM_FIELD_DEFAULT_REQUIRED",
        "Required fields must have a default value",
      );
    }
    if (!empty) {
      const error = validateCustomFieldValue(
        defaultValue,
        "multiselect",
        name,
        options,
      );
      if (error) invalidDefault(error);
    }
  }
}
