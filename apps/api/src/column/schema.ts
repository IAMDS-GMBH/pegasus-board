import { z } from "../openapi";

export const projectIdParam = z.object({ projectId: z.string() });

export const columnParam = z.object({ id: z.string() });

// Pegasus fork (PEGA-170): blank text clears the phase like null does.
const phase = z
  .string()
  .max(100)
  .nullable()
  .optional()
  .transform((value) =>
    value === undefined || value === null ? value : value.trim() || null,
  )
  .openapi({
    description:
      "Phase the board shows the column under; neighbouring columns of one phase share a heading. Null or blank text means no phase.",
  });

const isLocked = z.boolean().optional().openapi({
  description:
    "Technical column: only owners, instance admins and the Hub's system account move cards into or out of it. Fields stay editable.",
});

// Pegasus fork (PEGA-170, Nachtrag 26.11.2026).
const isRestricted = z.boolean().optional().openapi({
  description:
    "Technical column: only members whose Hub rights include LEAD_READ_INTAKE (and owners, instance admins, the Hub's system account) see it and its tasks.",
});

export const createColumnBody = z.object({
  name: z.string(),
  icon: z.string().optional(),
  color: z.string().optional(),
  isFinal: z.boolean().optional(),
  phase,
  isLocked,
  isRestricted,
});

export const updateColumnBody = z.object({
  name: z.string().optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  isFinal: z.boolean().optional(),
  phase,
  isLocked,
  isRestricted,
});

export const reorderColumnsBody = z.object({
  columns: z.array(z.object({ id: z.string(), position: z.number() })).openapi({
    description:
      "Every column keeps its new position. Columns from another project are rejected.",
  }),
});
