import assert from "node:assert/strict";
import { test } from "node:test";
import { createKaneoClient, normalizeBaseUrl } from "./kaneo-client.mjs";

test("the base URL works with and without /api", () => {
  assert.equal(
    normalizeBaseUrl("https://k.example.de"),
    "https://k.example.de/api",
  );
  assert.equal(
    normalizeBaseUrl("https://k.example.de/api/"),
    "https://k.example.de/api",
  );
});

test("requests carry the API key and a JSON body", async () => {
  const calls = [];
  const client = createKaneoClient({
    baseUrl: "http://localhost:1337",
    apiKey: "secret",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: "l1" }), { status: 200 });
    },
  });

  assert.deepEqual(await client.post("/label", { name: "Paket 1" }), {
    id: "l1",
  });
  assert.equal(calls[0].url, "http://localhost:1337/api/label");
  assert.equal(calls[0].init.headers.Authorization, "Bearer secret");
  assert.equal(calls[0].init.body, '{"name":"Paket 1"}');
});

test("an error carries the API message and status", async () => {
  const client = createKaneoClient({
    baseUrl: "http://localhost:1337",
    apiKey: "k",
    fetchImpl: async () =>
      new Response(JSON.stringify({ message: "Column has tasks" }), {
        status: 409,
      }),
  });

  await assert.rejects(client.delete("/column/c1"), (error) => {
    assert.equal(error.status, 409);
    assert.match(
      error.message,
      /DELETE \/column\/c1: Column has tasks \(409\)/,
    );
    return true;
  });
});

test("a 429 is retried after Retry-After", async () => {
  let attempts = 0;
  const client = createKaneoClient({
    baseUrl: "http://localhost:1337",
    apiKey: "k",
    fetchImpl: async () => {
      attempts += 1;
      return attempts === 1
        ? new Response("", { status: 429, headers: { "retry-after": "0.01" } })
        : new Response("[]", { status: 200 });
    },
  });

  assert.deepEqual(await client.get("/project"), []);
  assert.equal(attempts, 2);
});

test("an HTML page instead of JSON points at a wrong API URL", async () => {
  const client = createKaneoClient({
    baseUrl: "http://localhost:5173",
    apiKey: "k",
    fetchImpl: async () =>
      new Response("<!doctype html><html></html>", { status: 200 }),
  });

  await assert.rejects(
    client.get("/project"),
    /kein JSON.*localhost:5173\/api/,
  );
});
