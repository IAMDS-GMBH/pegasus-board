import type { Context } from "hono";

// Route middleware runs before the validators, so c.req.valid() is unavailable.
// Hono caches the parsed body, so the validator still reads it afterwards.
export async function readJsonBody(
  c: Context,
): Promise<Record<string, unknown>> {
  const raw = (await c.req.json().catch(() => ({}))) as unknown;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {};
  }
  return raw as Record<string, unknown>;
}
