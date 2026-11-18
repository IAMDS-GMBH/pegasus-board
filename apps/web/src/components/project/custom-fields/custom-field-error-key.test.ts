import { describe, expect, it } from "vite-plus/test";
import { HttpError } from "@/lib/http-error";
import { customFieldErrorKey } from "./custom-field-error-key";

// Pegasus fork (PEGA-90): field management errors show in the user's language.
describe("customFieldErrorKey", () => {
  it.each([
    ["CUSTOM_FIELD_NAME_REQUIRED", "nameRequired"],
    ["CUSTOM_FIELD_INVALID_DEFAULT", "invalidDefault"],
    ["CUSTOM_FIELD_TOO_FEW_OPTIONS", "tooFewOptions"],
    ["CUSTOM_FIELD_TYPE_LOCKED", "typeLocked"],
    ["CUSTOM_FIELD_OPTIONS_NOT_ALLOWED", "optionsNotAllowed"],
    ["CUSTOM_FIELD_OPTION_IN_USE", "optionInUse"],
    ["CUSTOM_FIELD_TASKS_HAVE_MULTIPLE_OPTIONS", "tasksHaveMultipleOptions"],
    // Pegasus fork (PEGA-86)
    ["CUSTOM_FIELD_TASKS_HAVE_INVALID_VALUES", "tasksHaveInvalidValues"],
    // Pegasus fork (PEGA-123)
    ["CUSTOM_FIELD_REQUIRED_MISSING_VALUES", "requiredMissingValues"],
    ["CUSTOM_FIELD_VALUE_REQUIRED", "valueRequired"],
    ["HUB_DEFINED_FIELD", "hubDefined"],
    ["HUB_MANAGED_FIELD", "hubManaged"],
    ["NOT_FOUND", "notFound"],
  ])("maps %s to a translated text", (code, key) => {
    expect(
      customFieldErrorKey(new HttpError(400, "English text", { code })),
    ).toBe(`settings:customFields.errors.${key}`);
  });

  it.each([
    ["an unknown code", new HttpError(400, "English text", { code: "X" })],
    ["a server error", new HttpError(500, "Internal Server Error")],
    ["a plain error", new Error("Network down")],
    ["a non-error", "oops"],
  ])("returns null for %s", (_name, error) => {
    expect(customFieldErrorKey(error)).toBeNull();
  });
});
