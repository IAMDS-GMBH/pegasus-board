import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import { TextFieldEditor } from "./text-field-editor";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

afterEach(cleanup);

const field = (type: CustomFieldDefinition["type"]): CustomFieldDefinition => ({
  id: "field-1",
  projectId: "project-1",
  name: "Notiz",
  type,
  required: false,
  defaultValue: null,
  options: null,
  position: 0,
  showOnCard: false,
  createdAt: "",
  updatedAt: "",
});

function renderEditor(type: CustomFieldDefinition["type"]) {
  const onSubmit = vi.fn();
  render(
    <TextFieldEditor
      field={field(type)}
      draft="Zeile 1"
      onDraftChange={vi.fn()}
      onSubmit={onSubmit}
    />,
  );
  return { onSubmit, input: screen.getByLabelText("Notiz") };
}

// Pegasus fork (PEGA-123): text fields hold notes with several lines.
describe("TextFieldEditor", () => {
  it("edits text in a textarea where Enter adds a line", () => {
    const { onSubmit, input } = renderEditor("text");

    expect(input.tagName).toBe("TEXTAREA");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("tasks:customFields.modEnterKey")).toBeTruthy();
  });

  it.each([{ metaKey: true }, { ctrlKey: true }])(
    "saves text with %j and Enter",
    (modifier) => {
      const { onSubmit, input } = renderEditor("text");

      fireEvent.keyDown(input, { key: "Enter", ...modifier });

      expect(onSubmit).toHaveBeenCalledTimes(1);
    },
  );

  it("keeps a single-line input with Enter to save for other types", () => {
    const { onSubmit, input } = renderEditor("phone");

    expect(input.tagName).toBe("INPUT");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
