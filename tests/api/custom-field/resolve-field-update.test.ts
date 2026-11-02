import { describe, expect, it } from "vite-plus/test";
import {
  type CurrentCustomField,
  resolveFieldUpdate,
} from "../../../apps/api/src/custom-field/resolve-field-update";

const dropdown: CurrentCustomField = {
  name: "Size",
  type: "dropdown",
  required: false,
  defaultValue: "Medium",
  options: ["Small", "Medium", "Large"],
  showOnCard: false,
};

describe("resolveFieldUpdate", () => {
  it("keeps what the request leaves out", () => {
    expect(resolveFieldUpdate(dropdown, { name: "  T-shirt size " })).toEqual({
      ...dropdown,
      name: "T-shirt size",
      removedOptions: [],
    });
  });

  it("switches the card preview on and keeps it when the request leaves it out", () => {
    const shown = resolveFieldUpdate(dropdown, { showOnCard: true });
    expect(shown.showOnCard).toBe(true);
    expect(
      resolveFieldUpdate({ ...dropdown, showOnCard: true }, { name: "Size" })
        .showOnCard,
    ).toBe(true);
  });

  it("rejects type changes other than dropdown and multiselect", () => {
    expect(() =>
      resolveFieldUpdate(
        { ...dropdown, type: "text", options: null, defaultValue: null },
        { type: "number" },
      ),
    ).toThrow("can't change");
  });

  // Pegasus fork (PEGA-86): a text field can become an email or phone field.
  describe("text, email and phone", () => {
    const text: CurrentCustomField = {
      ...dropdown,
      name: "Telefon",
      type: "text",
      options: null,
      defaultValue: null,
    };

    it.each([
      ["text", "phone"],
      ["text", "email"],
      ["phone", "text"],
      ["email", "phone"],
    ])("allows switching from %s to %s", (from, to) => {
      expect(
        resolveFieldUpdate({ ...text, type: from }, { type: to }).type,
      ).toBe(to);
    });

    it.each([
      ["email", "number"],
      ["phone", "url"],
      ["url", "phone"],
    ])("still rejects switching from %s to %s", (from, to) => {
      expect(() =>
        resolveFieldUpdate({ ...text, type: from }, { type: to }),
      ).toThrow("can't change");
    });

    it("stores a kept default in the new type's form", () => {
      expect(
        resolveFieldUpdate(
          { ...text, defaultValue: " 0170  1234567 " },
          { type: "phone" },
        ).defaultValue,
      ).toBe("0170 1234567");
    });

    it("rejects a kept default that does not fit the new type", () => {
      expect(() =>
        resolveFieldUpdate(
          { ...text, defaultValue: "keine Angabe" },
          { type: "phone" },
        ),
      ).toThrow('Custom field "Telefon" expects a phone number');
    });
  });

  it("rejects a blank name", () => {
    expect(() => resolveFieldUpdate(dropdown, { name: "  " })).toThrow(
      "Name cannot be empty",
    );
  });

  it("reports removed options and checks the default against new options", () => {
    expect(
      resolveFieldUpdate(dropdown, { options: ["Medium", "XL", "Medium"] }),
    ).toMatchObject({
      options: ["Medium", "XL"],
      removedOptions: ["Small", "Large"],
    });
    expect(() =>
      resolveFieldUpdate(dropdown, { options: ["Small", "Large"] }),
    ).toThrow("Default value must be one of the dropdown options");
  });

  it("converts the default when switching to multiselect", () => {
    expect(resolveFieldUpdate(dropdown, { type: "multiselect" })).toMatchObject(
      { type: "multiselect", defaultValue: '["Medium"]' },
    );
  });

  it("clears the default with null and requires one for required fields", () => {
    expect(
      resolveFieldUpdate(dropdown, { defaultValue: null }).defaultValue,
    ).toBeNull();
    expect(() =>
      resolveFieldUpdate(dropdown, { defaultValue: "", required: true }),
    ).toThrow("Required fields must have a default value");
  });

  it("rejects options on fields without options", () => {
    expect(() =>
      resolveFieldUpdate(
        { ...dropdown, type: "text", options: null, defaultValue: null },
        { options: ["a"] },
      ),
    ).toThrow("Only dropdown and multiselect fields have options");
  });
});
