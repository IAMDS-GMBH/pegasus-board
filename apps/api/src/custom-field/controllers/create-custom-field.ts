import { eq, max } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  customFieldDefinitionTable,
  projectTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { assertMayChangeDefinition } from "../hub-field-guard";
import type { HubFieldProperties } from "../hub-field-properties";
import { assertEveryTaskHasValue } from "../assert-every-task-has-value";
import { assertValidDefinition } from "../assert-valid-definition";
import { fieldError } from "../field-error";
import { insertMissingValues } from "../fill-default-values";
import { toStoredCustomFieldValue } from "../stored-value";

async function createCustomField(
  projectId: string,
  name: string,
  type: string,
  required: boolean,
  defaultValue?: string,
  options?: string[],
  showOnCard = false,
  // Pegasus fork (PEGA-123): group and Hub ownership.
  {
    section,
    hubDefined = false,
    hubManaged = false,
    userId,
  }: HubFieldProperties & { userId?: string } = {},
) {
  if (!name.trim())
    fieldError("CUSTOM_FIELD_NAME_REQUIRED", "Name cannot be empty");

  assertMayChangeDefinition(
    userId,
    { name: name.trim(), hubDefined: false },
    { hubDefined, hubManaged },
  );

  const [project] = await db
    .select({ id: projectTable.id })
    .from(projectTable)
    .where(eq(projectTable.id, projectId))
    .limit(1);

  if (!project) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  assertValidDefinition({ name, type, defaultValue, options });

  const storedDefaultValue =
    type === "date"
      ? defaultValue?.trim()
      : defaultValue && toStoredCustomFieldValue(type, defaultValue);

  const [maxPositionResult] = await db
    .select({ maxPosition: max(customFieldDefinitionTable.position) })
    .from(customFieldDefinitionTable)
    .where(eq(customFieldDefinitionTable.projectId, projectId));

  const field = await db.transaction(async (tx) => {
    const hasDefault =
      storedDefaultValue != null && storedDefaultValue.trim() !== "";
    if (required && !hasDefault) {
      await assertEveryTaskHasValue(tx, { projectId });
    }

    const [created] = await tx
      .insert(customFieldDefinitionTable)
      .values({
        projectId,
        name,
        type,
        required,
        defaultValue: storedDefaultValue ?? null,
        options: options ?? null,
        position: (maxPositionResult?.maxPosition ?? 0) + 1,
        showOnCard,
        section: section || null,
        hubDefined,
        hubManaged,
      })
      .returning();

    if (!created) {
      throw new HTTPException(500, {
        message: "Failed to create custom field",
      });
    }

    if (hasDefault) {
      await insertMissingValues(tx, {
        projectId,
        fieldId: created.id,
        value: storedDefaultValue,
      });
    }

    return created;
  });

  await publishEvent("project.updated", {
    projectId,
    customFieldsChanged: true,
  });

  return field;
}

export default createCustomField;
