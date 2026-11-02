import deDE from "@i18n/de-DE.json";
import enUS from "@i18n/en-US.json";
import { describe, expect, it } from "vite-plus/test";

type Tree = { [key: string]: string | Tree };

function leaves(tree: Tree, prefix: string): Array<[string, string]> {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string"
      ? [[`${prefix}.${key}`, value] as [string, string]]
      : leaves(value, `${prefix}.${key}`),
  );
}

function at(tree: Tree, path: string): Tree {
  return path.split(".").reduce((node, key) => node[key] as Tree, tree);
}

const fieldTypes = {
  text: "Text",
  number: "Zahl",
  date: "Datum",
  boolean: "Kontrollkästchen",
  dropdown: "Auswahl",
  multiselect: "Mehrfachauswahl",
  url: "Link",
  email: "E-Mail",
  phone: "Telefon",
};

// Words that are the same in German and English.
const sameInGerman = new Set(["Text", "Link", "Name", "Enter"]);

// Pegasus fork (PEGA-90): the field management is fully German.
describe("custom field translations", () => {
  it("names every field type in German", () => {
    expect(deDE.settings.customFields.types).toEqual(fieldTypes);
    const mobile = deDE.mobile.projectSettings;
    expect({
      text: mobile.text,
      number: mobile.number,
      date: mobile.date,
      boolean: mobile.checkbox,
      dropdown: mobile.dropdown,
      multiselect: mobile.multiSelect,
      url: mobile.url,
      email: mobile.email,
      phone: mobile.phone,
    }).toEqual(fieldTypes);
  });

  it.each([
    "settings.customFields",
    "settings.projectCustomFields",
    "tasks.customFields",
  ])("translates every text under %s", (path) => {
    const german = new Map(leaves(at(deDE as Tree, path), path));
    const untranslated = leaves(at(enUS as Tree, path), path).filter(
      ([key, english]) =>
        !german.has(key) ||
        (german.get(key) === english && !sameInGerman.has(english)),
    );
    expect(untranslated).toEqual([]);
  });

  it("has a text for every field error the API reports", () => {
    expect(Object.keys(deDE.settings.customFields.errors ?? {}).sort()).toEqual(
      [
        "defaultRequired",
        "invalidDefault",
        "nameRequired",
        "notFound",
        "optionInUse",
        "optionsNotAllowed",
        "tasksHaveInvalidValues",
        "tasksHaveMultipleOptions",
        "tooFewOptions",
        "typeLocked",
      ],
    );
  });
});
