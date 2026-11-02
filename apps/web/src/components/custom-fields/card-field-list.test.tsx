import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { CardFieldList } from "./card-field-list";
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
  { fieldId: "points", name: "Story points", type: "number", value: "5" },
  { fieldId: "billable", name: "Billable", type: "boolean", value: "true" },
  { fieldId: "customer", name: "Customer", type: "text", value: "Acme Corp" },
  {
    fieldId: "platforms",
    name: "Platforms",
    type: "multiselect",
    value: '["Web","iOS","Android"]',
  },
];

describe("CardFieldList", () => {
  it("shows the first chips and counts the rest", () => {
    render(<CardFieldList fields={fields} max={2} />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Billable")).toBeInTheDocument();
    expect(screen.queryByText("Acme Corp")).toBeNull();
    expect(
      screen.getByRole("button", { name: "tasks:customFields.moreFields" }),
    ).toHaveTextContent("+2");
  });

  it("formats multiselect values and skips the overflow chip when all fit", () => {
    render(<CardFieldList fields={fields.slice(3)} max={3} />);
    expect(screen.getByText("Web, iOS")).toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("names each value", () => {
    render(<CardFieldList fields={fields.slice(0, 1)} max={3} />);
    expect(screen.getByText("Story points")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders a link value as a link that leaves the card alone", () => {
    const onCardClick = vi.fn();
    const onCardPointerDown = vi.fn();
    const onCardKeyDown = vi.fn();
    const onCardMouseDown = vi.fn();
    render(
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- stands in for the task card
      <div
        onClick={onCardClick}
        onPointerDown={onCardPointerDown}
        onKeyDown={onCardKeyDown}
        onMouseDown={onCardMouseDown}
      >
        <CardFieldList
          fields={[
            {
              fieldId: "profile",
              name: "LinkedIn",
              type: "url",
              value: "https://linkedin.com/in/max",
            },
          ]}
          max={2}
        />
      </div>,
    );

    const link = screen.getByRole("link", { name: "linkedin.com/in/max" });
    expect(link).toHaveAttribute("href", "https://linkedin.com/in/max");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");

    fireEvent.pointerDown(link);
    fireEvent.mouseDown(link);
    fireEvent.click(link);
    fireEvent.keyDown(link, { key: "Enter" });
    expect(onCardClick).not.toHaveBeenCalled();
    expect(onCardPointerDown).not.toHaveBeenCalled();
    expect(onCardKeyDown).not.toHaveBeenCalled();
    expect(onCardMouseDown).not.toHaveBeenCalled();
  });

  it("never links a stored value that is not an http link", () => {
    render(
      <CardFieldList
        fields={[
          {
            fieldId: "profile",
            name: "LinkedIn",
            type: "url",
            value: "javascript:alert(1)",
          },
        ]}
        max={2}
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("javascript:alert(1)")).toBeInTheDocument();
  });

  // Pegasus fork (PEGA-86): contact values on list and backlog rows.
  it("renders phone and email values as tel: and mailto: links", () => {
    render(
      <CardFieldList
        fields={[
          {
            fieldId: "phone",
            name: "Telefon",
            type: "phone",
            value: "0170 1234567",
          },
          {
            fieldId: "email",
            name: "E-Mail",
            type: "email",
            value: "max@example.org",
          },
        ]}
        max={2}
      />,
    );
    expect(screen.getByRole("link", { name: "0170 1234567" })).toHaveAttribute(
      "href",
      "tel:01701234567",
    );
    expect(
      screen.getByRole("link", { name: "max@example.org" }),
    ).toHaveAttribute("href", "mailto:max@example.org");
  });

  it("renders nothing without fields", () => {
    const { container } = render(<CardFieldList fields={[]} max={2} />);
    expect(container).toBeEmptyDOMElement();
  });
});
