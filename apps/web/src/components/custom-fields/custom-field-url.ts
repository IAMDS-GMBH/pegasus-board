// Pegasus fork (PEGA-87): same rule as apps/api/src/custom-field/url-value.ts,
// so the value the editor commits is the value the API stores.

const MAX_URL_LENGTH = 2048;
const HAS_SCHEME = /^[a-z][a-z\d+.-]*:\/\//i;

/** `linkedin.com/in/x` → `https://linkedin.com/in/x`; `null` if not a link. */
export function normalizeCustomFieldUrl(value: string): string | null {
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

/** A link without scheme and trailing slash, for tight chips. */
export function customFieldUrlLabel(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");
}
