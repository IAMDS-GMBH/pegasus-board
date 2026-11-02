// Pegasus fork (PEGA-86): the `phone` custom field type. Numbers are stored as
// typed (spaces collapsed), not reformatted, because leads arrive in every
// local notation; clients build the `tel:` link from the digits.
// apps/web/src/components/custom-fields/custom-field-phone.ts applies the same
// rule for instant feedback.

const PHONE = /^\+?[\d ()/.-]+$/;
const MIN_DIGITS = 5;
// E.164 allows at most 15 digits after the country code prefix.
const MAX_DIGITS = 15;

/** The stored form of a phone number, or `null` if it isn't one. */
export function normalizePhoneValue(value: string): string | null {
  const collapsed = value.trim().replace(/\s+/g, " ");
  if (!PHONE.test(collapsed)) return null;

  const digits = collapsed
    .replace(/^\+(\d+) ?\(0\)/, "+$1")
    .replace(/\D/g, "")
    .replace(/^00/, "");
  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return null;

  return collapsed;
}
