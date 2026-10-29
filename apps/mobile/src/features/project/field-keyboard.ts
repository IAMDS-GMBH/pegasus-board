import type { KeyboardTypeOptions } from "react-native";

// Field types edited as typed text, each with the keyboard that fits it.
const TEXT_KEYBOARDS: Record<string, KeyboardTypeOptions> = {
  text: "default",
  number: "decimal-pad",
  url: "url",
  // Pegasus fork (PEGA-86)
  email: "email-address",
  phone: "phone-pad",
};

export function isTypedField(type: string) {
  return type in TEXT_KEYBOARDS;
}

export function fieldKeyboardType(type: string | undefined) {
  return (type && TEXT_KEYBOARDS[type]) || "default";
}
