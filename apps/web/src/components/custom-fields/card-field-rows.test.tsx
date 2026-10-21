import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { CardFieldRows } from "./card-field-rows";
import type { CardField } from "./card-fields";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const fields: CardField[] = [
  { fieldId: "campaign", name: "Kampagne", type: "text", value: "Herbst 26" },
  { fieldId: "package", name: "Paket", type: "number", value: "2" },
  { fieldId: "consent", name: "Einwilligung", type: "boolean", value: "true" },
  {
    fieldId: "channels",
    name: "Kanäle",
    type: "multiselect",
    value: '["Meta","LinkedIn","Formular"]',
  },
  { fieldId: "date", name: "Termin am", type: "date", value: "2026-10-22" },
];

describe("CardFieldRows", () => {
  it("renders nothing without fields", () => {
    const { container } = render(<CardFieldRows fields={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists every field as a label and its value", () => {
    render(<CardFieldRows fields={fields} />);
    const terms = screen.getAllByRole("term").map((term) => term.textContent);
    expect(terms).toEqual([
      "Kampagne",
      "Paket",
      "Einwilligung",
      "Kanäle",
      "Termin am",
    ]);
    expect(screen.getByText("Herbst 26")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("settings:customFields.checked")).toHaveClass(
      "sr-only",
    );
    expect(screen.getByText("Meta, LinkedIn")).toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.queryByText("2026-10-22")).toBeNull();
  });

  it("opens a link without opening the card", () => {
    const onCardClick = vi.fn();
    render(
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- stands in for the task card
      <div onClick={onCardClick}>
        <CardFieldRows
          fields={[
            {
              fieldId: "profile",
              name: "LinkedIn",
              type: "url",
              value: "https://linkedin.com/in/max",
            },
          ]}
        />
      </div>,
    );
    const link = screen.getByRole("link", { name: "linkedin.com/in/max" });
    expect(link).toHaveAttribute("href", "https://linkedin.com/in/max");
    fireEvent.click(link);
    expect(onCardClick).not.toHaveBeenCalled();
  });
});
