// Mirrors apps/api/src/column/to-slug.ts: the API derives a column's slug from
// its name this way, so the script can find a column even after a rename.
export function toSlug(name) {
  const slug = name
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return /[\p{L}\p{N}]/u.test(slug) ? slug : "";
}
