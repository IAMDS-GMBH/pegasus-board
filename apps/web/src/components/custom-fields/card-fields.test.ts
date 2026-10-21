import { describe, expect, it } from "vite-plus/test";
import type { CustomFieldValue } from "@/hooks/queries/custom-field/use-get-custom-field-values-by-project";
import { cardFieldsForTask } from "./card-fields";

const value = (
  taskId: string,
  fieldId: string,
  fieldType: string,
  raw: string | null,
  fieldPosition: number,
  fieldShowOnCard = true,
): CustomFieldValue => ({
  id: `${taskId}-${fieldId}`,
  taskId,
  fieldId,
  value: raw,
  fieldName: fieldId,
  fieldPosition,
  fieldType,
  fieldOptions: null,
  fieldShowOnCard,
});

const values = [
  value("t1", "release", "date", "2026-10-22", 2),
  value("t1", "points", "number", "5", 0),
  value("t1", "billable", "boolean", "false", 1),
  value("t1", "platforms", "multiselect", "[]", 3),
  value("t1", "customer", "text", "", 4),
  value("t1", "urgent", "boolean", "true", 5),
  value("t2", "points", "number", "3", 0),
  value("t1", "notes", "text", "Not for the card", 6, false),
];

describe("cardFieldsForTask", () => {
  it("keeps filled fields for the task in field order", () => {
    expect(cardFieldsForTask(values, "t1", []).map((f) => f.fieldId)).toEqual([
      "points",
      "release",
      "urgent",
    ]);
  });

  it("leaves out fields the admin did not put on the card", () => {
    expect(
      cardFieldsForTask(values, "t1", []).some((f) => f.fieldId === "notes"),
    ).toBe(false);
  });

  it("drops fields the person hid from cards", () => {
    expect(
      cardFieldsForTask(values, "t1", ["points"]).map((f) => f.fieldId),
    ).toEqual(["release", "urgent"]);
  });

  it("returns nothing without data or values for the task", () => {
    expect(cardFieldsForTask(undefined, "t1", [])).toEqual([]);
    expect(cardFieldsForTask(values, "t3", [])).toEqual([]);
  });
});
