import { and, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import db from "../../database";
import { publishEvent } from "../../events";
import {
  customFieldDefinitionTable,
  customFieldValueTable,
  taskTable,
} from "../../database/schema";
import { fieldError } from "../field-error";
import { assertMaySetValues } from "../hub-field-guard";
import { toStoredCustomFieldValue } from "../stored-value";
import {
  type CustomFieldValueType,
  isCustomFieldValueEmpty,
} from "../../task/validate-task-fields";
import { normalizeEmailValue } from "../email-value";
import { normalizePhoneValue } from "../phone-value";
import { normalizeUrlValue } from "../url-value";

function valueOrNull(value: string | null, type: string) {
  if (value === null) return null;
  return isCustomFieldValueEmpty(value, type as CustomFieldValueType)
    ? null
    : value;
}

function isMultiselectEmpty(value: string): boolean {
  if (!value || value.trim().length === 0) return true;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.length === 0;
  } catch {
    return false;
  }
}

async function setCustomFieldValue(
  taskId: string,
  fieldId: string,
  value: string,
  userId?: string,
) {
  const [task] = await db
    .select({
      projectId: taskTable.projectId,
    })
    .from(taskTable)
    .where(eq(taskTable.id, taskId))
    .limit(1);

  if (!task) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  const [field] = await db
    .select()
    .from(customFieldDefinitionTable)
    .where(eq(customFieldDefinitionTable.id, fieldId))
    .limit(1);

  if (!field || field.projectId !== task.projectId) {
    throw new HTTPException(404, {
      message: "Custom field not found",
    });
  }

  assertMaySetValues(userId, [field]);

  const normalizedValue = value.trim();

  // Pegasus fork (PEGA-123): a stable code for the web.
  if (
    field.required &&
    (field.type === "multiselect"
      ? isMultiselectEmpty(normalizedValue)
      : normalizedValue.length === 0)
  ) {
    fieldError("CUSTOM_FIELD_VALUE_REQUIRED", "This custom field is required");
  }

  if (field.type === "dropdown" && normalizedValue.length > 0) {
    if (
      Array.isArray(field.options) &&
      !field.options.includes(normalizedValue)
    ) {
      throw new HTTPException(400, {
        message: "Invalid option for this custom field",
      });
    }
  }

  if (field.type === "number" && normalizedValue.length > 0) {
    if (Number.isNaN(Number(normalizedValue))) {
      throw new HTTPException(400, {
        message: "Value must be a valid number",
      });
    }
  }

  if (field.type === "boolean" && normalizedValue.length > 0) {
    if (normalizedValue !== "true" && normalizedValue !== "false") {
      throw new HTTPException(400, {
        message: "Value must be true or false",
      });
    }
  }

  if (field.type === "multiselect" && normalizedValue.length > 0) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(normalizedValue);
    } catch {
      throw new HTTPException(400, {
        message: "Value must be a valid JSON array",
      });
    }

    if (!Array.isArray(parsed)) {
      throw new HTTPException(400, {
        message: "Value must be a JSON array",
      });
    }

    if (Array.isArray(field.options)) {
      const options = field.options as string[];

      const invalid = parsed.some(
        (v) => typeof v !== "string" || !options.includes(v),
      );

      if (invalid) {
        throw new HTTPException(400, {
          message: "Invalid option(s) for this custom field",
        });
      }
    }
  }

  if (field.type === "url" && normalizedValue.length > 0) {
    if (!normalizeUrlValue(normalizedValue)) {
      throw new HTTPException(400, {
        message: "Value must be an http or https link",
      });
    }
  }

  // Pegasus fork (PEGA-86): contact fields.
  if (field.type === "email" && normalizedValue.length > 0) {
    if (!normalizeEmailValue(normalizedValue)) {
      throw new HTTPException(400, {
        message: "Value must be an email address",
      });
    }
  }

  if (field.type === "phone" && normalizedValue.length > 0) {
    if (!normalizePhoneValue(normalizedValue)) {
      throw new HTTPException(400, { message: "Value must be a phone number" });
    }
  }

  const { result, oldValue } = await db.transaction(async (tx) => {
    const [previous] = await tx
      .select({ value: customFieldValueTable.value })
      .from(customFieldValueTable)
      .where(
        and(
          eq(customFieldValueTable.taskId, taskId),
          eq(customFieldValueTable.fieldId, fieldId),
        ),
      )
      .for("update");

    const [result] = await tx
      .insert(customFieldValueTable)
      .values({
        taskId,
        fieldId,
        value: toStoredCustomFieldValue(field.type, normalizedValue),
      })
      .onConflictDoUpdate({
        target: [customFieldValueTable.taskId, customFieldValueTable.fieldId],
        set: {
          value: sql`excluded.value`,
        },
      })
      .returning();

    return { result, oldValue: previous?.value ?? null };
  });

  await publishEvent("task.updated", {
    taskId,
    projectId: task.projectId,
    customFieldsChanged: true,
  });

  // Pegasus fork (PEGA-123): one event per changed value for webhooks.
  const before = valueOrNull(oldValue, field.type);
  const after = valueOrNull(result?.value ?? null, field.type);
  if (before !== after) {
    await publishEvent("task.custom_field_changed", {
      taskId,
      projectId: task.projectId,
      userId: userId ?? null,
      fieldId,
      fieldName: field.name,
      fieldType: field.type,
      oldValue: before,
      newValue: after,
    });
  }

  return result;
}

export default setCustomFieldValue;
