// Fork (PEGA-92): replaces the product name Kaneo with {{appName}} in the
// namespaces the web app, the mobile app and the invitation email read, so a
// brand sets the name once. Run after every upstream sync; it is idempotent.
// landing and press belong to the public kaneo.app site and stay as they are.
import { loadLocales, writeJson } from "./shared.mjs";

const NAMESPACES = new Set([
  "common",
  "auth",
  "settings",
  "invitations",
  "mobile",
]);
// Shown only when the mobile app offers upstream's hosted cloud.
const KEEP = new Set(["mobile.signIn.cloud", "mobile.signIn.tagline"]);
// The header name X-Kaneo-Signature is a protocol identifier.
const NAME = /(?<![A-Za-z])(?<!X-)Kaneo/g;

function brandValue(value, key) {
  if (key.endsWith(".breadcrumbKaneo")) return "{{appName}}";
  return value
    .replaceAll("Kaneo Cloud", "{{appName}}")
    .replace(NAME, "{{appName}}")
    .replaceAll(
      "https://example.com/webhooks/kaneo",
      "https://example.com/webhook",
    );
}

function walk(node, path) {
  for (const [key, value] of Object.entries(node)) {
    const next = [...path, key];
    if (typeof value === "string") {
      if (NAMESPACES.has(next[0]) && !KEEP.has(next.join("."))) {
        node[key] = brandValue(value, next.join("."));
      }
    } else if (value && typeof value === "object") {
      walk(value, next);
    }
  }
}

const { locales } = await loadLocales();
let changed = 0;
for (const { path, data } of locales) {
  const before = JSON.stringify(data);
  walk(data, []);
  if (JSON.stringify(data) !== before) {
    await writeJson(path, data);
    changed += 1;
  }
}
console.log(`Branded ${changed} locale file(s).`);
