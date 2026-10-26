import { fieldError } from "./field-error";
import { assertValidDefinition } from "./assert-valid-definition";
import {
  convertChoiceValue,
  isChoiceType,
  normalizeOptions,
  readOptions,
} from "./choice-options";
import { toStoredCustomFieldValue } from "./url-value";

export type CurrentCustomField = {
  name: string;
  type: string;
  required: boolean;
  defaultValue: string | null;
  options: unknown;
  showOnCard: boolean;
};

export type CustomFieldUpdateInput = {
  name?: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | null;
  options?: string[];
  showOnCard?: boolean;
};

export type ResolvedFieldUpdate = {
  name: string;
  type: string;
  required: boolean;
  defaultValue: string | null;
  options: unknown;
  showOnCard: boolean;
  removedOptions: string[];
};

function resolveType(field: CurrentCustomField, requested?: string) {
  const type = requested ?? field.type;
  if (type === field.type) return type;
  if (isChoiceType(type) && isChoiceType(field.type)) return type;

  fieldError(
    "CUSTOM_FIELD_TYPE_LOCKED",
    "The type of a custom field can't change. Only dropdown and multiselect fields can switch between each other.",
  );
}

function resolveDefault(
  field: CurrentCustomField,
  type: string,
  requested: string | null | undefined,
) {
  if (requested !== undefined) {
    if (requested === null || requested.trim() === "") return null;
    if (type === "date") return requested.trim();
    return toStoredCustomFieldValue(type, requested);
  }

  if (
    field.defaultValue === null ||
    type === field.type ||
    !isChoiceType(type) ||
    !isChoiceType(field.type)
  ) {
    return field.defaultValue;
  }

  const converted = convertChoiceValue(field.defaultValue, field.type, type);
  if (converted === undefined) {
    fieldError(
      "CUSTOM_FIELD_INVALID_DEFAULT",
      "The default has more than one option picked. Send a default with one option.",
    );
  }
  return converted || null;
}

export function resolveFieldUpdate(
  field: CurrentCustomField,
  input: CustomFieldUpdateInput,
): ResolvedFieldUpdate {
  const type = resolveType(field, input.type);

  const name = input.name === undefined ? field.name : input.name.trim();
  if (!name) fieldError("CUSTOM_FIELD_NAME_REQUIRED", "Name cannot be empty");

  if (input.options !== undefined && !isChoiceType(type)) {
    fieldError(
      "CUSTOM_FIELD_OPTIONS_NOT_ALLOWED",
      "Only dropdown and multiselect fields have options",
    );
  }

  const previousOptions = readOptions(field.options);
  const options = isChoiceType(type)
    ? input.options === undefined
      ? previousOptions
      : normalizeOptions(input.options)
    : null;

  const required = input.required ?? field.required;
  const defaultValue = resolveDefault(field, type, input.defaultValue);

  assertValidDefinition({ name, type, required, defaultValue, options });

  return {
    name,
    type,
    required,
    defaultValue,
    options: options ?? field.options,
    showOnCard: input.showOnCard ?? field.showOnCard,
    removedOptions: options
      ? previousOptions.filter((option) => !options.includes(option))
      : [],
  };
}
