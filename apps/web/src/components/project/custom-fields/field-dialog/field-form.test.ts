import { describe, expect, it } from "vite-plus/test";
import {
  addOption,
  EMPTY_FIELD_FORM,
  type FieldFormState,
  formFromField,
  getFormIssue,
  moveOption,
  removeOption,
  renameOption,
  setKind,
  setMultiple,
  toCreatePayload,
  toUpdatePayload,
} from "@/components/project/custom-fields/field-dialog/field-form";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";

const dropdown: FieldFormState = {
  ...EMPTY_FIELD_FORM,
  kind: "dropdown",
  name: "Size",
  options: ["Small", "Medium", "Large"],
  defaultValue: "Medium",
};

function definition(
  overrides: Partial<CustomFieldDefinition>,
): CustomFieldDefinition {
  return {
    id: "f1",
    projectId: "p1",
    name: "Field",
    type: "text",
    required: false,
    defaultValue: null,
    options: null,
    position: 0,
    showOnCard: false,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("formFromField", () => {
  it("starts empty for a new field", () => {
    expect(formFromField(null)).toBe(EMPTY_FIELD_FORM);
  });

  it("reads a multiselect field as a dropdown that allows several", () => {
    expect(
      formFromField(
        definition({
          type: "multiselect",
          options: ["iOS", "Web"],
          defaultValue: '["Web"]',
        }),
      ),
    ).toMatchObject({
      kind: "dropdown",
      multiple: true,
      defaultValue: "",
      defaultValues: ["Web"],
    });
  });

  it("reads a checkbox without a default as unchecked", () => {
    expect(formFromField(definition({ type: "boolean" })).defaultValue).toBe(
      "false",
    );
  });
});

describe("options", () => {
  it("adds trimmed options once", () => {
    const next = addOption(addOption(dropdown, "  XL "), "XL");
    expect(next.options).toEqual(["Small", "Medium", "Large", "XL"]);
    expect(addOption(dropdown, "   ")).toBe(dropdown);
  });

  it("drops the default with a removed option", () => {
    expect(removeOption(dropdown, "Medium")).toMatchObject({
      options: ["Small", "Large"],
      defaultValue: "",
    });
  });

  it("renames the default with its option and refuses duplicates", () => {
    expect(renameOption(dropdown, "Medium", " M ")).toMatchObject({
      options: ["Small", "M", "Large"],
      defaultValue: "M",
    });
    expect(renameOption(dropdown, "Medium", "Small")).toBe(dropdown);
    expect(renameOption(dropdown, "Medium", " ")).toBe(dropdown);
  });

  it("reorders options", () => {
    expect(moveOption(dropdown, 2, 0).options).toEqual([
      "Large",
      "Small",
      "Medium",
    ]);
  });
});

describe("type changes", () => {
  it("resets the default when the type changes", () => {
    expect(setKind(dropdown, "boolean")).toMatchObject({
      kind: "boolean",
      defaultValue: "false",
      multiple: false,
    });
  });

  it("carries the default across allowing several", () => {
    const multiple = setMultiple(dropdown, true);
    expect(multiple).toMatchObject({
      defaultValue: "",
      defaultValues: ["Medium"],
    });
    expect(setMultiple(multiple, false)).toMatchObject({
      defaultValue: "Medium",
      defaultValues: [],
    });
  });
});

describe("getFormIssue", () => {
  it("needs a name", () => {
    expect(getFormIssue({ ...dropdown, name: "  " })).toBe("nameRequired");
  });

  it("needs one option, or two when several are allowed", () => {
    expect(getFormIssue({ ...dropdown, options: [], defaultValue: "" })).toBe(
      "optionsRequired",
    );
    expect(
      getFormIssue({ ...dropdown, multiple: true, options: ["Small"] }),
    ).toBe("moreOptionsRequired");
  });

  it("needs a default for required fields", () => {
    expect(
      getFormIssue({ ...EMPTY_FIELD_FORM, name: "Customer", required: true }),
    ).toBe("defaultRequired");
    expect(
      getFormIssue({
        ...dropdown,
        multiple: true,
        required: true,
        defaultValue: "",
        defaultValues: [],
      }),
    ).toBe("defaultRequired");
    expect(getFormIssue({ ...dropdown, required: true })).toBeNull();
  });

  it("needs a link as the default of a link field", () => {
    const link = { ...EMPTY_FIELD_FORM, kind: "url" as const, name: "Profil" };
    expect(getFormIssue({ ...link, defaultValue: "kein link" })).toBe(
      "invalidUrl",
    );
    expect(getFormIssue({ ...link, defaultValue: "example.org" })).toBeNull();
    expect(getFormIssue(link)).toBeNull();
  });

  // Pegasus fork (PEGA-86)
  it.each([
    ["email", "max(at)example.org", "max@example.org", "invalidEmail"],
    ["phone", "keine Angabe", "0170 1234567", "invalidPhone"],
  ] as const)(
    "needs a default that fits a %s field",
    (kind, bad, good, issue) => {
      const contact = { ...EMPTY_FIELD_FORM, kind, name: "Kontakt" };
      expect(getFormIssue({ ...contact, defaultValue: bad })).toBe(issue);
      expect(getFormIssue({ ...contact, defaultValue: good })).toBeNull();
      expect(getFormIssue(contact)).toBeNull();
    },
  );
});

describe("payloads", () => {
  it("creates a multiselect with a JSON default", () => {
    expect(
      toCreatePayload(
        {
          ...dropdown,
          multiple: true,
          defaultValue: "",
          defaultValues: ["Small"],
        },
        "p1",
      ),
    ).toEqual({
      projectId: "p1",
      name: "Size",
      type: "multiselect",
      required: false,
      defaultValue: '["Small"]',
      options: ["Small", "Medium", "Large"],
      showOnCard: false,
    });
  });

  it("sends a link default in its stored form", () => {
    expect(
      toCreatePayload(
        {
          ...EMPTY_FIELD_FORM,
          kind: "url",
          name: "Profil",
          defaultValue: " linkedin.com/company/x ",
        },
        "p1",
      ),
    ).toEqual({
      projectId: "p1",
      name: "Profil",
      type: "url",
      required: false,
      defaultValue: "https://linkedin.com/company/x",
      options: undefined,
      showOnCard: false,
    });
  });

  it("sends a phone default in its stored form", () => {
    expect(
      toCreatePayload(
        {
          ...EMPTY_FIELD_FORM,
          kind: "phone",
          name: "Telefon",
          defaultValue: " 089   12345 ",
        },
        "p1",
      ).defaultValue,
    ).toBe("089 12345");
  });

  it("leaves options out of other types and clears empty defaults", () => {
    expect(
      toUpdatePayload({
        ...EMPTY_FIELD_FORM,
        kind: "number",
        name: " Estimate ",
      }),
    ).toEqual({
      name: "Estimate",
      type: "number",
      required: false,
      defaultValue: null,
      showOnCard: false,
    });
  });

  it("carries the card preview setting from the field into both payloads", () => {
    const form = formFromField(definition({ showOnCard: true }));
    expect(form.showOnCard).toBe(true);
    expect(toCreatePayload(form, "p1").showOnCard).toBe(true);
    expect(toUpdatePayload({ ...form, showOnCard: false }).showOnCard).toBe(
      false,
    );
  });
});
