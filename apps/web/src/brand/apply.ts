import { brand } from "./index";

// Runs before the first render so the brand class, favicon and title are in
// place without an unbranded flash. index.html itself stays static.
export function applyBrand() {
  if (brand.htmlClass) {
    document.documentElement.classList.add(brand.htmlClass);
  }

  for (const link of document.querySelectorAll<HTMLLinkElement>(
    'link[rel="icon"], link[rel="shortcut icon"]',
  )) {
    link.href = brand.favicon;
  }

  document.title = brand.name;
}
