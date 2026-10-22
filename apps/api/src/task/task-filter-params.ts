// Pegasus fork (PEGA-89): board filters that run in the database. Both
// parameters arrive JSON-encoded in the query string so the web app can send
// several fields and values in one request.
import { z } from "../openapi";

export const MAX_FILTER_LABELS = 20;
export const MAX_FILTER_LABEL_LENGTH = 100;
export const MAX_FILTER_FIELDS = 10;
export const MAX_FILTER_VALUES = 50;
export const MAX_FILTER_VALUE_LENGTH = 500;

export type TaskLabelFilter = string[];
export type TaskCustomFieldFilter = Record<string, string[]>;

type Ctx = { addIssue: (issue: { code: "custom"; message: string }) => void };

function fail(ctx: Ctx, message: string) {
  ctx.addIssue({ code: "custom", message });
  return z.NEVER;
}

function parseJson(raw: string, ctx: Ctx, what: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return fail(ctx, `${what} must be JSON`);
  }
}

function uniqueStrings(values: unknown[], maxLength: number) {
  const unique: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (trimmed.length > maxLength) return null;
    if (trimmed && !unique.includes(trimmed)) unique.push(trimmed);
  }
  return unique;
}

export const labelsParam = z
  .string()
  .optional()
  .transform((raw, ctx): TaskLabelFilter | undefined => {
    if (raw === undefined) return undefined;
    const parsed = parseJson(raw, ctx, "labels");
    if (parsed === z.NEVER) return z.NEVER;
    if (!Array.isArray(parsed)) return fail(ctx, "labels must be an array");
    if (parsed.length > MAX_FILTER_LABELS)
      return fail(ctx, `labels allows at most ${MAX_FILTER_LABELS} names`);
    const names = uniqueStrings(parsed, MAX_FILTER_LABEL_LENGTH);
    if (!names) return fail(ctx, "labels must contain short strings");
    return names.length ? names : undefined;
  })
  .openapi({
    type: "string",
    description:
      'JSON array of label names; a task matches when it carries any of them, e.g. ["Kampagne A"].',
  });

export const customFieldsParam = z
  .string()
  .optional()
  .transform((raw, ctx): TaskCustomFieldFilter | undefined => {
    if (raw === undefined) return undefined;
    const parsed = parseJson(raw, ctx, "customFields");
    if (parsed === z.NEVER) return z.NEVER;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return fail(ctx, "customFields must be an object of field id to values");
    const entries = Object.entries(parsed as Record<string, unknown>);
    if (entries.length > MAX_FILTER_FIELDS)
      return fail(
        ctx,
        `customFields allows at most ${MAX_FILTER_FIELDS} fields`,
      );
    const filter: TaskCustomFieldFilter = {};
    for (const [fieldId, values] of entries) {
      if (!Array.isArray(values))
        return fail(ctx, "customFields values must be arrays");
      if (values.length > MAX_FILTER_VALUES)
        return fail(
          ctx,
          `customFields allows at most ${MAX_FILTER_VALUES} values per field`,
        );
      const unique = uniqueStrings(values, MAX_FILTER_VALUE_LENGTH);
      if (!unique)
        return fail(ctx, "customFields values must be short strings");
      if (unique.length) filter[fieldId] = unique;
    }
    return Object.keys(filter).length ? filter : undefined;
  })
  .openapi({
    type: "string",
    description:
      'JSON object of custom field id to allowed values. A task matches when every listed field holds one of its values (multiselect: any selected option), e.g. {"<fieldId>":["P2"]}.',
  });
