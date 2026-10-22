import { render } from "@react-email/render";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import MagicLinkEmail from "../templates/magic-link";
import PasswordResetEmail from "../templates/password-reset";
import WorkspaceInvitationEmail from "../templates/workspace-invitation";
import { appName, withAppName } from "./app-name";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("appName", () => {
  it("defaults to WWK Board", () => {
    vi.stubEnv("APP_NAME", "");
    expect(appName()).toBe("WWK Board");
  });

  it("uses APP_NAME when set", () => {
    vi.stubEnv("APP_NAME", " Kaneo ");
    expect(appName()).toBe("Kaneo");
  });
});

describe("withAppName", () => {
  it("replaces the name in strings, nested copy and copy functions", () => {
    vi.stubEnv("APP_NAME", "WWK Board");
    const copy = withAppName({
      title: "Bei Kaneo anmelden",
      nested: { footer: "Kaneo-Benachrichtigung" },
      greet: (name: string) => `Hallo ${name}, willkommen bei Kaneo`,
    });

    expect(copy.title).toBe("Bei WWK Board anmelden");
    expect(copy.nested.footer).toBe("WWK Board-Benachrichtigung");
    expect(copy.greet("Kim")).toBe("Hallo Kim, willkommen bei WWK Board");
  });
});

describe("emails under the WWK name", () => {
  it("never mention Kaneo or link to kaneo.app", async () => {
    vi.stubEnv("APP_NAME", "");
    const emails = await Promise.all([
      render(
        createElement(MagicLinkEmail, {
          magicLink: "https://board.example/auth",
          locale: "de-DE",
        }),
      ),
      render(
        createElement(PasswordResetEmail, {
          resetLink: "https://board.example/reset",
          locale: "de-DE",
        }),
      ),
      render(
        createElement(WorkspaceInvitationEmail, {
          workspaceName: "Innendienst",
          inviterName: "Kim",
          inviterEmail: "kim@example.com",
          invitationLink: "https://board.example/invitation/accept/1",
          to: "maya@example.com",
          copy: {
            subject: "{{inviterName}} lädt dich zu {{workspaceName}} ein",
            preview: "Einladung zu {{workspaceName}} auf {{appName}}",
            title: "{{workspaceName}} beitreten",
            subtitle: "{{inviterName}} hat dich zu {{appName}} eingeladen.",
            cta: "Einladung annehmen",
            sameEmail: "Nimm sie mit dieser E-Mail-Adresse an.",
            ignore: "Unerwartet? Dann ignoriere diese E-Mail.",
            footer: "{{appName}} Workspace-Einladung",
          },
        }),
      ),
    ]);

    for (const html of emails) {
      expect(html).not.toMatch(/kaneo/i);
      expect(html).toContain("WWK Board");
      expect(html).toContain("/mark-wwk.png");
    }
    expect(emails[0]).toContain("Bei WWK Board anmelden");
    expect(emails[2]).toContain("WWK Board Workspace-Einladung");
  });
});
