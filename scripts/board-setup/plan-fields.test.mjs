import assert from "node:assert/strict";
import { test } from "node:test";
import { planFields } from "./plan-fields.mjs";

const paket = {
  name: "Paket",
  type: "dropdown",
  options: ["Paket 1", "Paket 2", "Paket 3"],
  showOnCard: true,
};

function field(overrides) {
  return {
    id: "f",
    name: "Paket",
    type: "dropdown",
    required: false,
    options: ["Paket 1", "Paket 2", "Paket 3"],
    showOnCard: true,
    position: 0,
    ...overrides,
  };
}

test("missing fields are created", () => {
  const { actions, errors } = planFields(
    [paket, { name: "PLZ", type: "text" }],
    [],
  );

  assert.deepEqual(
    actions.map((a) => [a.type, a.field.name]),
    [
      ["create-field", "Paket"],
      ["create-field", "PLZ"],
    ],
  );
  assert.deepEqual(errors, []);
});

test("an up-to-date field needs nothing", () => {
  const { actions, warnings, errors } = planFields([paket], [field()]);

  assert.deepEqual([actions, warnings, errors], [[], [], []]);
});

test("missing options are added and extra options are kept", () => {
  const { actions, warnings } = planFields(
    [paket],
    [field({ options: ["Paket 1", "Sonderpaket"] })],
  );

  assert.deepEqual(actions[0].changes, {
    options: ["Paket 1", "Sonderpaket", "Paket 2", "Paket 3"],
  });
  assert.match(warnings[0], /Sonderpaket/);
});

test("required is switched off and showOnCard follows the spec", () => {
  const { actions } = planFields(
    [paket],
    [field({ required: true, showOnCard: false })],
  );

  assert.deepEqual(actions[0].changes, { required: false, showOnCard: true });
});

test("a type the API cannot convert stops the run", () => {
  const { actions, errors } = planFields(
    [{ name: "Telefon", type: "text" }],
    [
      field({
        name: "Telefon",
        type: "number",
        options: null,
        showOnCard: false,
      }),
    ],
  );

  assert.deepEqual(actions, []);
  assert.match(errors[0], /Telefon.*number.*text/);
});

test("dropdown and multiselect can switch", () => {
  const { actions, errors } = planFields(
    [paket],
    [field({ type: "multiselect" })],
  );

  assert.deepEqual(errors, []);
  assert.deepEqual(actions[0].changes, { type: "dropdown" });
});

test("a field outside the spec stays and is reported", () => {
  const { actions, warnings } = planFields(
    [paket],
    [
      field(),
      field({
        id: "g",
        name: "Notiz",
        type: "text",
        options: null,
        showOnCard: false,
      }),
    ],
  );

  assert.deepEqual(actions, []);
  assert.match(warnings[0], /Notiz/);
});
