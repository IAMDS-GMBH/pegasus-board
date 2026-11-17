import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { getNotificationSettingsUrl } from "../../../apps/api/src/utils/notification-settings-url";

// Pegasus fork (PEGA-80): the Pegasus Hub owns each user's notification
// settings; the board only links there.
describe("getNotificationSettingsUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    [
      "https://admin.example.com/notifications",
      "https://admin.example.com/notifications",
    ],
    [
      "  http://localhost:3000/notifications ",
      "http://localhost:3000/notifications",
    ],
  ])("returns the absolute URL %j", (value, expected) => {
    vi.stubEnv("PEGASUS_NOTIFICATION_SETTINGS_URL", value);
    expect(getNotificationSettingsUrl()).toBe(expected);
  });

  it.each([
    undefined,
    "",
    "   ",
    "/notifications",
    "admin.example.com/notifications",
    "javascript:alert(1)",
    "ftp://admin.example.com/notifications",
  ])("returns null for %j", (value) => {
    vi.stubEnv("PEGASUS_NOTIFICATION_SETTINGS_URL", value);
    expect(getNotificationSettingsUrl()).toBeNull();
  });
});
