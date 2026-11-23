import { describe, expect, it } from "vite-plus/test";
import {
  DEFAULT_API_KEY_RATE_LIMIT_MAX,
  resolveApiKeyRateLimitMax,
} from "../../apps/api/src/utils/api-key-rate-limit";

describe("API key rate limit setting", () => {
  it("defaults to more than 100 requests per minute", () => {
    expect(DEFAULT_API_KEY_RATE_LIMIT_MAX).toBeGreaterThan(100);
    expect(resolveApiKeyRateLimitMax(undefined)).toBe(
      DEFAULT_API_KEY_RATE_LIMIT_MAX,
    );
  });

  it("accepts a positive integer", () => {
    expect(resolveApiKeyRateLimitMax("2500")).toBe(2500);
    expect(resolveApiKeyRateLimitMax(" 300 ")).toBe(300);
  });

  it.each(["", "abc", "0", "-5", "1.5"])(
    "falls back to the default for %j",
    (raw) => {
      expect(resolveApiKeyRateLimitMax(raw)).toBe(
        DEFAULT_API_KEY_RATE_LIMIT_MAX,
      );
    },
  );
});
