import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { brandIndexHtml } from "./brand-index-html";
import { brands } from "./brands";

const indexHtml = readFileSync(
  path.resolve(__dirname, "../../index.html"),
  "utf8",
);

describe("brandIndexHtml", () => {
  it("leaves index.html untouched for Kaneo", () => {
    expect(brandIndexHtml(indexHtml, brands.kaneo)).toBe(indexHtml);
  });

  it("removes every Kaneo mention for WWK", () => {
    const html = brandIndexHtml(indexHtml, brands.wwk);

    expect(html).not.toMatch(/kaneo/i);
    expect(html).toContain("<title>WWK Board</title>");
    expect(html).toContain(
      '<meta name="apple-mobile-web-app-title" content="WWK Board" />',
    );
    expect(html).toContain(
      '<meta name="application-name" content="WWK Board">',
    );
    expect(html).toContain(
      '<link rel="manifest" href="/brands/wwk/site.webmanifest" />',
    );
    expect(html).toContain(
      '<link rel="icon" type="image/svg+xml" href="/brands/wwk/favicon.svg" />',
    );
    expect(html).toContain(
      '<link rel="apple-touch-icon" href="/brands/wwk/apple-touch-icon.png" />',
    );
    expect(html).toContain('<meta name="theme-color" content="#ffffff" />');
  });

  it("keeps the app entry script", () => {
    expect(brandIndexHtml(indexHtml, brands.wwk)).toContain(
      '<script type="module" src="/src/main.tsx"></script>',
    );
  });
});
