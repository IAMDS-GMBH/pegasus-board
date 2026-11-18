import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import { CustomFieldRow } from "./custom-field-row";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const field = (
  overrides: Partial<CustomFieldDefinition>,
): CustomFieldDefinition => ({
  id: "field-1",
  projectId: "project-1",
  name: "Telefon",
  type: "text",
  required: false,
  defaultValue: null,
  options: null,
  position: 0,
  showOnCard: false,
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

// Pegasus fork (PEGA-86): the task view calls or writes with one tap.
describe("CustomFieldRow", () => {
  it.each([
    [
      "url",
      "https://linkedin.com/in/max",
      "tasks:customFields.openLink",
      "https://linkedin.com/in/max",
    ],
    [
      "phone",
      "0170 1234567",
      "tasks:customFields.callNumber",
      "tel:01701234567",
    ],
    [
      "email",
      "max@example.org",
      "tasks:customFields.sendEmail",
      "mailto:max@example.org",
    ],
  ] as const)(
    "links the %s value next to its editor",
    (type, value, label, href) => {
      render(
        <CustomFieldRow
          field={field({ type })}
          value={value}
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByRole("link", { name: label })).toHaveAttribute(
        "href",
        href,
      );
    },
  );

  it.each([
    ["text", "0170 1234567"],
    ["phone", "keine Angabe"],
  ] as const)("shows no link for a %s value %j", (type, value) => {
    render(
      <CustomFieldRow
        field={field({ type })}
        value={value}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
  });

  // Pegasus fork (PEGA-123): only the Pegasus Hub sets these values.
  it("shows a hubManaged value read-only with a lock", () => {
    render(
      <CustomFieldRow
        field={field({ name: "Lead-ID", hubManaged: true })}
        value="lead-1"
        onChange={vi.fn()}
      />,
    );

    const value = screen.getByRole("button", { name: /Lead-ID/ });
    expect(value).toBeDisabled();
    expect(value).toHaveTextContent("lead-1");
    expect(value).toHaveAttribute("title", "tasks:customFields.hubManaged");
    expect(value.querySelector("[data-hub-lock]")).not.toBeNull();
  });

  // Pegasus fork (PEGA-123): the agent's note often has several paragraphs.
  it("shows a text value with its line breaks", () => {
    render(
      <CustomFieldRow
        field={field({ name: "Zusätzliche Informationen" })}
        value={"Ruft ab 17 Uhr zurück.\n\nHat schon ein Angebot."}
        onChange={vi.fn()}
      />,
    );

    const text = screen.getByText(/Ruft ab 17 Uhr/);
    expect(text.textContent).toBe(
      "Ruft ab 17 Uhr zurück.\n\nHat schon ein Angebot.",
    );
    expect(text).toHaveClass("whitespace-pre-line");
    expect(text).not.toHaveClass("truncate");
  });
});
