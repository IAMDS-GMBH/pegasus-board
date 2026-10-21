import type { Plugin } from "vite-plus";
import { brandIndexHtml } from "./src/brand/brand-index-html";
import { type Brand, resolveBrand } from "./src/brand/brands";

// Applies the VITE_BRAND brand to index.html in dev and build.
export function brandHtmlPlugin(): Plugin {
  let brand: Brand;
  return {
    name: "brand-index-html",
    configResolved(config) {
      brand = resolveBrand(config.env.VITE_BRAND);
    },
    transformIndexHtml(html) {
      return brandIndexHtml(html, brand);
    },
  };
}
