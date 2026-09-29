import { describe, expect, it } from "vitest";
import { brands, resolveBrand } from "./index";

describe("resolveBrand", () => {
  it("falls back to WWK when no brand is configured", () => {
    expect(resolveBrand(undefined)).toBe(brands.wwk);
    expect(resolveBrand("")).toBe(brands.wwk);
  });

  it("falls back to WWK for unknown or prototype keys", () => {
    expect(resolveBrand("nope")).toBe(brands.wwk);
    expect(resolveBrand("toString")).toBe(brands.wwk);
  });

  it("resolves the configured brand", () => {
    expect(resolveBrand("kaneo")).toBe(brands.kaneo);
    expect(resolveBrand("wwk")).toBe(brands.wwk);
    expect(brands.wwk.name).toBe("WWK Board");
    expect(brands.wwk.htmlClass).toBe("theme-wwk");
  });
});
