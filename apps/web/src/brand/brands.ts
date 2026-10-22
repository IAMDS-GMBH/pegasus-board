// Pure brand data, also imported by vite.config.ts, so no `import.meta.env`.
export const brands = {
  kaneo: {
    id: "kaneo",
    name: "Kaneo",
    htmlClass: null,
    logo: {
      onLight: "/logo-dark.svg",
      onDark: "/logo-light.svg",
      heightClassName: "h-6",
    },
    favicon: "/favicon.svg",
    // Kaneo keeps apps/web/index.html and site.webmanifest as they are.
    document: null,
    upstreamLinks: true,
  },
  wwk: {
    id: "wwk",
    name: "WWK Board",
    htmlClass: "theme-wwk",
    logo: {
      // The WWK lockup is a stacked mark with claim (300x159), so it needs
      // more height than the wide Kaneo wordmark to stay legible.
      onLight: "/brands/wwk/logo.svg",
      onDark: "/brands/wwk/logo-negative.svg",
      heightClassName: "h-16",
    },
    favicon: "/brands/wwk/favicon.svg",
    document: {
      description: "WWK Board für die Bearbeitung von Bewerber-Leads.",
      faviconPng: "/brands/wwk/favicon-96x96.png",
      faviconIco: "/brands/wwk/favicon.ico",
      appleTouchIcon: "/brands/wwk/apple-touch-icon.png",
      manifest: "/brands/wwk/site.webmanifest",
      themeColor: "#ffffff",
    },
    // "Powered by Kaneo" and links to kaneo.app.
    upstreamLinks: false,
  },
} as const;

export type BrandId = keyof typeof brands;
export type Brand = (typeof brands)[BrandId];

function isBrandId(id: string): id is BrandId {
  return Object.hasOwn(brands, id);
}

export const defaultBrandId: BrandId = "wwk";

export function resolveBrand(id: string | undefined): Brand {
  if (id && isBrandId(id)) {
    return brands[id];
  }
  return brands[defaultBrandId];
}
