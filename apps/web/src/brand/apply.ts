import { brand } from "./index";

// Runs before the first render so the brand class is in place without an
// unbranded flash. Title, icons and manifest come from the build
// (see brand-index-html.ts).
export function applyBrand() {
  if (brand.htmlClass) {
    document.documentElement.classList.add(brand.htmlClass);
  }
}
