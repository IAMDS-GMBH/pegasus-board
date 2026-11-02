// Pegasus fork (PEGA-86): field types that hold free text and can switch into
// each other. Switching to email or phone checks every task value first
// (plan-text-value-changes.ts).
const TEXT_TYPES = ["text", "email", "phone"];

export function isTextType(type: string) {
  return TEXT_TYPES.includes(type);
}
