// Pegasus fork (PEGA-86): same rule as apps/api/src/custom-field/phone-value.ts,
// so the value the editor commits is the value the API stores.

const PHONE = /^\+?[\d ()/.-]+$/;
const MIN_DIGITS = 5;
const MAX_DIGITS = 15;

/** `+49 (0) 170` dials as `+49170`: the trunk zero is dropped. */
function dialDigits(value: string) {
  return value.replace(/^\+(\d+) ?\(0\)/, "+$1").replace(/[^\d+]/g, "");
}

/** The number with spaces collapsed, or `null` if it isn't one. */
export function normalizeCustomFieldPhone(value: string): string | null {
  const collapsed = value.trim().replace(/\s+/g, " ");
  if (!PHONE.test(collapsed)) return null;

  const digits = dialDigits(collapsed).replace(/^\+|^00/, "");
  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return null;

  return collapsed;
}

/** `tel:` link for a phone value, or `null` if it isn't a phone number. */
export function customFieldPhoneHref(value: string): string | null {
  const phone = normalizeCustomFieldPhone(value);
  return phone ? `tel:${dialDigits(phone)}` : null;
}
