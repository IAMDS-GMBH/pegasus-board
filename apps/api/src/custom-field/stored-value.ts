import { normalizeEmailValue } from "./email-value";
import { normalizePhoneValue } from "./phone-value";
import { normalizeUrlValue } from "./url-value";

const NORMALIZERS: Record<string, (value: string) => string | null> = {
  // Pegasus fork (PEGA-87): links are stored with their scheme.
  url: normalizeUrlValue,
  // Pegasus fork (PEGA-86): contact values are stored trimmed.
  email: normalizeEmailValue,
  phone: normalizePhoneValue,
};

/**
 * The value to store for a field type. A value that doesn't fit is returned
 * unchanged, so the caller's validation reports it.
 */
export function toStoredCustomFieldValue(type: string, value: string) {
  const normalize = NORMALIZERS[type];
  if (!normalize) return value;
  return normalize(value) ?? value;
}
