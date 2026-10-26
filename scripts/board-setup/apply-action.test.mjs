import assert from "node:assert/strict";
import { test } from "node:test";
import { applyAction } from "./apply-action.mjs";
import { KaneoRequestError } from "./kaneo-client.mjs";

const context = { workspaceId: "w", projectId: "p" };

function recordingClient(response = {}) {
  const calls = [];
  const record = (method) => async (path, body) => {
    calls.push([method, path, body]);
    if (response instanceof Error) throw response;
    return response;
  };
  return {
    calls,
    get: record("GET"),
    post: record("POST"),
    put: record("PUT"),
    delete: record("DELETE"),
  };
}

test("a default column that still holds cards stays, with a warning", async () => {
  const client = recordingClient(
    new KaneoRequestError("DELETE", "/column/c1", 409, {
      message: "has tasks",
    }),
  );
  const result = await applyAction(
    client,
    { type: "delete-column", id: "c1", name: "To Do" },
    context,
  );

  assert.match(result.warning, /To Do/);
});

test("other API errors are not swallowed", async () => {
  const client = recordingClient(
    new KaneoRequestError("DELETE", "/column/c1", 403, {
      message: "Forbidden",
    }),
  );

  await assert.rejects(
    applyAction(
      client,
      { type: "delete-column", id: "c1", name: "To Do" },
      context,
    ),
    /Forbidden/,
  );
});

test("fields are created optional, in the board's project", async () => {
  const client = recordingClient();
  await applyAction(
    client,
    {
      type: "create-field",
      field: {
        name: "Paket",
        type: "dropdown",
        options: ["Paket 1", "Paket 2"],
        showOnCard: true,
      },
    },
    context,
  );

  assert.deepEqual(client.calls, [
    [
      "POST",
      "/custom-field",
      {
        projectId: "p",
        name: "Paket",
        type: "dropdown",
        required: false,
        options: ["Paket 1", "Paket 2"],
        showOnCard: true,
      },
    ],
  ]);
});

test("a label update sends its name along, as the API requires", async () => {
  const client = recordingClient();
  await applyAction(
    client,
    {
      type: "update-label",
      id: "l",
      name: "Paket 1",
      changes: { color: "orange" },
    },
    context,
  );

  assert.deepEqual(client.calls, [
    ["PUT", "/label/l", { name: "Paket 1", color: "orange" }],
  ]);
});
