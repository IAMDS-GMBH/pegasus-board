import { and, eq, inArray, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  customFieldDefinitionTable,
  customFieldValueTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { isChoiceType } from "../choice-options";
import { fillEmptyValues } from "../fill-default-values";
import { planChoiceValueChanges } from "../plan-choice-value-changes";
import { planTextValueChanges } from "../plan-text-value-changes";
import {
  type CustomFieldUpdateInput,
  resolveFieldUpdate,
} from "../resolve-field-update";

async function updateCustomField(id: string, input: CustomFieldUpdateInput) {
  const updated = await db.transaction(async (tx) => {
    const [field] = await tx
      .select()
      .from(customFieldDefinitionTable)
      .where(eq(customFieldDefinitionTable.id, id))
      .limit(1)
      .for("update");

    if (!field) {
      throw new HTTPException(404, { message: "Custom field not found" });
    }

    const next = resolveFieldUpdate(field, input);
    const from = field.type;
    const to = next.type;
    const choiceChange =
      isChoiceType(from) &&
      isChoiceType(to) &&
      (next.removedOptions.length > 0 || to !== from);
    // Pegasus fork (PEGA-86): resolveFieldUpdate only lets a non-choice field
    // change type within text, email and phone.
    const textChange = !choiceChange && to !== from;

    if (choiceChange || textChange) {
      const rows = await tx
        .selectDistinct({ value: customFieldValueTable.value })
        .from(customFieldValueTable)
        .where(eq(customFieldValueTable.fieldId, id));
      const values = rows.map((row) => row.value);

      const changes = choiceChange
        ? planChoiceValueChanges({
            values,
            from,
            to,
            removedOptions: next.removedOptions,
          })
        : planTextValueChanges({ values, to });

      if (changes.length > 0) {
        const cases = sql.join(
          changes.map((change) => sql`when ${change.from} then ${change.to}`),
          sql` `,
        );
        await tx
          .update(customFieldValueTable)
          .set({ value: sql`case ${customFieldValueTable.value} ${cases} end` })
          .where(
            and(
              eq(customFieldValueTable.fieldId, id),
              inArray(
                customFieldValueTable.value,
                changes.map((change) => change.from),
              ),
            ),
          );
      }
    }

    const [updated] = await tx
      .update(customFieldDefinitionTable)
      .set({
        name: next.name,
        type: next.type,
        required: next.required,
        defaultValue: next.defaultValue,
        options: next.options,
        showOnCard: next.showOnCard,
      })
      .where(eq(customFieldDefinitionTable.id, id))
      .returning();

    if (!updated) {
      throw new HTTPException(404, { message: "Custom field not found" });
    }

    if (next.required && !field.required && next.defaultValue !== null) {
      await fillEmptyValues(tx, {
        projectId: field.projectId,
        fieldId: id,
        value: next.defaultValue,
      });
    }

    return updated;
  });

  await publishEvent("project.updated", {
    projectId: updated.projectId,
    customFieldsChanged: true,
  });

  return updated;
}

export default updateCustomField;
