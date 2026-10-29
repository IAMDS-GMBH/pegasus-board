import { z } from "../openapi";

export const projectIdParam = z.object({
  projectId: z.string(),
});

export const taskIdParam = z.object({
  taskId: z.string(),
});

export const customFieldIdParam = z.object({
  id: z.string(),
});

const customFieldType = z.enum([
  "text",
  "number",
  "date",
  "dropdown",
  "boolean",
  "multiselect",
  // Pegasus fork (PEGA-87): an http(s) link, stored normalized.
  "url",
  // Pegasus fork (PEGA-86): contact fields, rendered as mailto: and tel: links.
  "email",
  "phone",
]);

export const createCustomFieldBody = z.object({
  projectId: z.string(),
  name: z.string(),
  type: customFieldType.openapi({
    description:
      "`url` holds an http or https link. Values without a scheme get `https://`, and the normalized link is stored. `email` holds one email address, stored trimmed. `phone` holds a phone number with digits, spaces, a leading `+` and `( ) / . -`; it is stored as typed with spaces collapsed.",
  }),
  required: z.boolean().optional().default(false),
  defaultValue: z.string().optional(),
  options: z.array(z.string()).optional(),
  showOnCard: z.boolean().optional().default(false).openapi({
    description:
      "Whether the field's value appears on the task card in the board and on list rows.",
  }),
});

export const updateCustomFieldBody = z.object({
  name: z.string().optional().openapi({
    description: "New name for the field. Cannot be blank.",
  }),
  type: customFieldType.optional().openapi({
    description:
      "Only `dropdown` and `multiselect` can switch between each other, and `text`, `email` and `phone` can switch between each other. Task values are converted. Switching to `dropdown` is rejected while a task has more than one option picked, and switching to `email` or `phone` is rejected while a task has a value that doesn't fit. Any other type change is rejected.",
  }),
  required: z.boolean().optional().openapi({
    description:
      "Whether every task must have a value. Turning it on needs a default, which fills tasks that have no value yet.",
  }),
  defaultValue: z.string().nullable().optional().openapi({
    description:
      "Value new tasks start with. Send `null` or an empty string to clear it. Multiselect defaults are a JSON array of options.",
  }),
  options: z.array(z.string()).optional().openapi({
    description:
      "The full option list for dropdown and multiselect fields, in display order. Adding and reordering options is always allowed. Removing or renaming an option that a task still uses is rejected with 400, so task values are never changed silently.",
  }),
  showOnCard: z.boolean().optional().openapi({
    description:
      "Whether the field's value appears on the task card in the board and on list rows.",
  }),
});

export const reorderCustomFieldsBody = z.object({
  fields: z.array(
    z.object({
      id: z.string(),
      position: z.number(),
    }),
  ),
});

export const setCustomFieldValueBody = z.object({
  taskId: z.string(),
  fieldId: z.string(),
  value: z.string(),
});
