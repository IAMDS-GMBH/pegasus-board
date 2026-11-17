import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { Route } from "./notifications";

const config = vi.fn();
const replace = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Navigate: ({ to, replace }: { to: string; replace?: boolean }) => (
    <div data-testid="navigate" data-to={to} data-replace={String(replace)} />
  ),
}));

vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => config(),
}));

vi.mock("@/components/settings/notifications/notification-settings", () => ({
  NotificationSettings: () => <div data-testid="notification-settings" />,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

const NotificationsPage = (Route as unknown as { component: ComponentType })
  .component;
const originalLocation = window.location;

beforeEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, replace },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalLocation,
  });
});

// Pegasus fork (PEGA-80): the Pegasus Hub owns notification settings; the
// board's own page only hands over.
describe("account notifications route", () => {
  it("sends the user to the Hub's notification settings", () => {
    config.mockReturnValue({
      data: {
        notificationSettingsUrl: "https://admin.example.com/notifications",
      },
      isPending: false,
    });

    render(<NotificationsPage />);

    expect(replace).toHaveBeenCalledWith(
      "https://admin.example.com/notifications",
    );
    expect(screen.queryByTestId("notification-settings")).toBeNull();
    expect(screen.queryByTestId("navigate")).toBeNull();
  });

  it("falls back to the profile page without the Hub's URL", () => {
    config.mockReturnValue({
      data: { notificationSettingsUrl: null },
      isPending: false,
    });

    render(<NotificationsPage />);

    const navigate = screen.getByTestId("navigate");
    expect(navigate.dataset.to).toBe("/dashboard/settings/account/information");
    expect(navigate.dataset.replace).toBe("true");
    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByTestId("notification-settings")).toBeNull();
  });

  it("renders nothing while the config loads", () => {
    config.mockReturnValue({ data: undefined, isPending: true });

    const { container } = render(<NotificationsPage />);

    expect(container.innerHTML).toBe("");
    expect(replace).not.toHaveBeenCalled();
  });
});
