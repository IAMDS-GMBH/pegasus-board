export const DEFAULT_API_KEY_RATE_LIMIT_MAX = 1000;

// Requests per 60 s window for newly created API keys. Invalid or empty
// values fall back to the default so a typo never locks every key out.
export function resolveApiKeyRateLimitMax(
  raw = process.env.API_KEY_RATE_LIMIT_MAX,
): number {
  const value = Number(raw?.trim());
  return Number.isInteger(value) && value > 0
    ? value
    : DEFAULT_API_KEY_RATE_LIMIT_MAX;
}
