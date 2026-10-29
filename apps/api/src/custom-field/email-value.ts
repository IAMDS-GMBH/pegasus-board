// Pegasus fork (PEGA-86): the `email` custom field type. Values are rendered as
// `mailto:` links, so characters that would add headers or a second recipient
// (`?`, `&`, `,`, `;`) are rejected rather than escaped.
// apps/web/src/components/custom-fields/custom-field-email.ts applies the same
// rule for instant feedback.

const MAX_EMAIL_LENGTH = 254;
const PART = String.raw`[^\s@?#&,;:<>"()[\]\\]+`;
const EMAIL = new RegExp(`^${PART}@${PART}\\.${PART}$`);

/** The stored form of an email address (trimmed), or `null` if it isn't one. */
export function normalizeEmailValue(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length > MAX_EMAIL_LENGTH || !EMAIL.test(trimmed)) return null;
  return trimmed;
}
