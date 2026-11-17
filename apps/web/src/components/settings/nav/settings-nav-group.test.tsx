import { cleanup, render, screen } from "@testing-library/react";
import { Bell, User } from "lucide-react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { SettingsNavGroup } from "@/components/settings/nav/settings-nav-group";
import { SidebarProvider } from "@/components/ui/sidebar";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children?: ReactNode }) => (
    <a href={to} data-router-link="" {...props}>
      {children}
    </a>
  ),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

afterEach(() => {
  cleanup();
});

// Pegasus fork (PEGA-80): the notifications entry leads to the Pegasus Hub.
describe("SettingsNavGroup", () => {
  function renderGroup() {
    return render(
      <SidebarProvider>
        <SettingsNavGroup
          pathname="/dashboard/settings/account/information"
          group={{
            id: "account",
            label: "settings:account",
            links: [
              {
                id: "information",
                label: "settings:information",
                to: "/dashboard/settings/account/information",
                icon: User,
              },
              {
                id: "notifications",
                label: "settings:notifications",
                to: "https://admin.example.com/notifications",
                icon: Bell,
                external: true,
              },
            ],
          }}
        />
      </SidebarProvider>,
    );
  }

  it("opens an external link in a new tab and says so", () => {
    renderGroup();

    const link = screen.getByRole("link", {
      name: "settings:notifications settings:opensInNewTab",
    });
    expect(link.getAttribute("href")).toBe(
      "https://admin.example.com/notifications",
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.hasAttribute("data-router-link")).toBe(false);
  });

  it("keeps internal links in the router", () => {
    renderGroup();

    const link = screen.getByRole("link", { name: "settings:information" });
    expect(link.hasAttribute("data-router-link")).toBe(true);
    expect(link.getAttribute("target")).toBeNull();
    expect(link.getAttribute("data-active")).toBe("true");
  });
});
