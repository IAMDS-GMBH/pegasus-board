import type { Brand } from "./brands";

function escapeAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}

// Rewrites the head of apps/web/index.html for a brand at build and dev time,
// so link previews, the browser tab and an installed PWA never show Kaneo.
// index.html stays the upstream file; brand-index-html.test.ts runs this
// against it and fails when an upstream change leaves Kaneo behind.
export function brandIndexHtml(html: string, brand: Brand): string {
  const doc = brand.document;
  if (!doc) return html;

  const name = escapeAttribute(brand.name);
  const description = escapeAttribute(doc.description);

  return (
    html
      .replace(/<title>[^<]*<\/title>/, `<title>${name}</title>`)
      .replace(
        /<meta name="title"[^>]*>/,
        `<meta name="title" content="${name}">`,
      )
      .replace(
        /<meta name="description"[^>]*>/,
        `<meta name="description" content="${description}">`,
      )
      // Marketing tags of kaneo.app: keywords, OpenGraph, Twitter, canonical.
      .replace(/\s*<meta name="keywords"[^>]*>/, "")
      .replace(/\s*<meta property="(?:og|twitter):[^>]*>/g, "")
      .replace(/\s*<link rel="canonical"[^>]*>/, "")
      // Plausible analytics, only active on the kaneo.app hosts.
      .replace(
        /\s*<script>(?:(?!<\/script>)[\s\S])*?kaneo\.app[\s\S]*?<\/script>/,
        "",
      )
      .replace(
        /<link rel="icon"[^>]*>/,
        `<link rel="icon" type="image/svg+xml" href="${brand.favicon}" />\n  <link rel="icon" type="image/png" sizes="96x96" href="${doc.faviconPng}" />`,
      )
      .replace(
        /<link rel="shortcut icon"[^>]*>/,
        `<link rel="shortcut icon" href="${doc.faviconIco}" />`,
      )
      .replace(
        /<link rel="apple-touch-icon"[^>]*>/,
        `<link rel="apple-touch-icon" href="${doc.appleTouchIcon}" />`,
      )
      .replace(
        /<meta name="apple-mobile-web-app-title"[^>]*>/,
        `<meta name="apple-mobile-web-app-title" content="${name}" />`,
      )
      .replace(
        /<link rel="manifest"[^>]*>/,
        `<link rel="manifest" href="${doc.manifest}" />\n  <meta name="theme-color" content="${doc.themeColor}" />`,
      )
      .replace(
        /<meta name="application-name"[^>]*>/,
        `<meta name="application-name" content="${name}">`,
      )
  );
}
