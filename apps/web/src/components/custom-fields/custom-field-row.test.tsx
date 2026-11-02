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
});
