import { resolveBrand } from "./brands";

export { brands, resolveBrand, type Brand, type BrandId } from "./brands";

export const brand = resolveBrand(import.meta.env.VITE_BRAND);
