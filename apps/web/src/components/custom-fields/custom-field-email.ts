// Pegasus fork (PEGA-86): same rule as apps/api/src/custom-field/email-value.ts,
// so the value the editor commits is the value the API stores.

const MAX_EMAIL_LENGTH = 254;
const PART = String.raw`[^\s@?#&,;:<>"()[\]\\]+`;
const EMAIL = new RegExp(`^${PART}@${PART}\\.${PART}$`);

/** The trimmed address, or `null` if it can't safely become a `mailto:`. */
export function normalizeCustomFieldEmail(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length > MAX_EMAIL_LENGTH || !EMAIL.test(trimmed)) return null;
  return trimmed;
}
