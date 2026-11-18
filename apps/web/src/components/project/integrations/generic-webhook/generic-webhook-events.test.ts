import { describe, expect, it } from "vite-plus/test";
import {
  GENERIC_WEBHOOK_EVENT_ITEMS,
  toGenericWebhookEvents,
} from "./generic-webhook-events";

// Pegasus fork (PEGA-123): the Hub subscribes to custom field changes.
describe("generic webhook events", () => {
  it("offers custom field changes, off unless saved on", () => {
    expect(GENERIC_WEBHOOK_EVENT_ITEMS.map((item) => item.id)).toContain(
      "taskCustomFieldChanged",
    );
    expect(toGenericWebhookEvents().taskCustomFieldChanged).toBe(false);
    expect(
      toGenericWebhookEvents({ taskCustomFieldChanged: true })
        .taskCustomFieldChanged,
    ).toBe(true);
  });
});
