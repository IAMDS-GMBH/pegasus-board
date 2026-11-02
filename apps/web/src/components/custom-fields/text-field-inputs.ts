import type { HTMLAttributes } from "react";
import type { CustomFieldType } from "@/components/project/custom-fields/types";
import { normalizeCustomFieldEmail } from "./custom-field-email";
import { normalizeCustomFieldPhone } from "./custom-field-phone";
import { normalizeCustomFieldUrl } from "./custom-field-url";

type TextFieldInput = {
  type: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  /** The stored form of a draft, or `null` when it doesn't fit the type. */
  normalize?: (value: string) => string | null;
  invalidKey?: string;
};

/** Field types edited in a single text input, and how each is checked. */
export const TEXT_FIELD_INPUTS: Partial<
  Record<CustomFieldType, TextFieldInput>
> = {
  text: { type: "text" },
  number: { type: "number", inputMode: "decimal" },
  url: {
    type: "url",
    inputMode: "url",
    normalize: normalizeCustomFieldUrl,
    invalidKey: "tasks:customFields.invalidUrl",
  },
  // Pegasus fork (PEGA-86): phones get the dial pad, emails the @ keyboard.
  email: {
    type: "email",
    inputMode: "email",
    normalize: normalizeCustomFieldEmail,
    invalidKey: "tasks:customFields.invalidEmail",
  },
  phone: {
    type: "tel",
    inputMode: "tel",
    normalize: normalizeCustomFieldPhone,
    invalidKey: "tasks:customFields.invalidPhone",
  },
};
