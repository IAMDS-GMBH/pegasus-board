// Pegasus fork (PEGA-87): the `url` custom field type. Values are stored as a
// normalized http(s) link so every client can render them as a link without
// re-checking the scheme. apps/web/src/components/custom-fields/
// custom-field-url.ts applies the same rule for instant feedback.

const MAX_URL_LENGTH = 2048;
const HAS_SCHEME = /^[a-z][a-z\d+.-]*:\/\//i;

/**
 * Returns the stored form of a link (`linkedin.com/in/x` becomes
 * `https://linkedin.com/in/x`), or `null` when the value is not a usable http
 * or https link. Rejects other schemes, credentials, whitespace and hosts
 * without a dot, so `javascript:`, `mailto:` and typos never become links.
 */
export function normalizeUrlValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;

  let url: URL;
  try {
    url = new URL(HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (url.hostname !== "localhost" && !url.hostname.includes(".")) return null;
  if (url.href.length > MAX_URL_LENGTH) return null;

  return url.href;
}

/** The value to store for a field type; only links are rewritten. */
export function toStoredCustomFieldValue(type: string, value: string) {
  if (type !== "url") return value;
  return normalizeUrlValue(value) ?? value;
}
