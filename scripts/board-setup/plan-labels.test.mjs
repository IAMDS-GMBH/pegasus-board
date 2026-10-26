import assert from "node:assert/strict";
import { test } from "node:test";
import { planLabels } from "./plan-labels.mjs";

const spec = [
  { name: "Paket 1", color: "orange" },
  { name: "Quelle: Meta", color: "teal" },
];

test("missing workspace labels are created; card copies do not count", () => {
  const labels = [
    {
      id: "copy",
      name: "Paket 1",
      color: "orange",
      taskId: "t1",
      workspaceId: "w",
    },
  ];
  const { actions } = planLabels(spec, labels);

  assert.deepEqual(
    actions.map((a) => [a.type, a.label.name]),
    [
      ["create-label", "Paket 1"],
      ["create-label", "Quelle: Meta"],
    ],
  );
});

test("a changed colour is set back, matching labels are left alone", () => {
  const labels = [
    { id: "p1", name: "Paket 1", color: "red", taskId: null, workspaceId: "w" },
    {
      id: "m",
      name: "Quelle: Meta",
      color: "teal",
      taskId: null,
      workspaceId: "w",
    },
  ];
  const { actions } = planLabels(spec, labels);

  assert.deepEqual(actions, [
    {
      type: "update-label",
      id: "p1",
      name: "Paket 1",
      changes: { color: "orange" },
    },
  ]);
});

test("a label that is being deleted is reported, not recreated", () => {
  const labels = [
    {
      id: "p1",
      name: "Paket 1",
      color: "orange",
      taskId: null,
      deletionStartedAt: "2026-10-26",
    },
  ];
  const { actions, warnings } = planLabels([spec[0]], labels);

  assert.deepEqual(actions, []);
  assert.match(warnings[0], /Paket 1/);
});
