import { describe, expect, it } from "vite-plus/test";
import {
  customFieldsParam,
  labelsParam,
  MAX_FILTER_FIELDS,
  MAX_FILTER_LABELS,
  MAX_FILTER_VALUES,
} from "../../../apps/api/src/task/task-filter-params";

describe("labelsParam", () => {
  it("is optional", () => {
    expect(labelsParam.safeParse(undefined)).toEqual({
      success: true,
      data: undefined,
    });
  });

  it("parses a JSON array of label names", () => {
    expect(labelsParam.parse('["Kampagne A","Meta"]')).toEqual([
      "Kampagne A",
      "Meta",
    ]);
  });

  it("drops duplicates and blank names", () => {
    expect(labelsParam.parse('["A","A"," ",""]')).toEqual(["A"]);
  });

  it("rejects malformed JSON, non-arrays and non-strings", () => {
    expect(labelsParam.safeParse("Kampagne A").success).toBe(false);
    expect(labelsParam.safeParse('{"a":1}').success).toBe(false);
    expect(labelsParam.safeParse("[1]").success).toBe(false);
  });

  it("rejects more than the allowed number of names", () => {
    const names = Array.from({ length: MAX_FILTER_LABELS + 1 }, (_, i) =>
      String(i),
    );
    expect(labelsParam.safeParse(JSON.stringify(names)).success).toBe(false);
    expect(labelsParam.safeParse(JSON.stringify(names.slice(1))).success).toBe(
      true,
    );
  });

  it("rejects over-long names", () => {
    expect(
      labelsParam.safeParse(JSON.stringify(["x".repeat(101)])).success,
    ).toBe(false);
  });
});

describe("customFieldsParam", () => {
  it("is optional", () => {
    expect(customFieldsParam.safeParse(undefined)).toEqual({
      success: true,
      data: undefined,
    });
  });

  it("parses an object of field id to allowed values", () => {
    expect(customFieldsParam.parse('{"f1":["P1","P2"],"f2":["x"]}')).toEqual({
      f1: ["P1", "P2"],
      f2: ["x"],
    });
  });

  it("drops fields without values and duplicate values", () => {
    expect(customFieldsParam.parse('{"f1":[],"f2":["a","a"]}')).toEqual({
      f2: ["a"],
    });
  });

  it("returns undefined for an empty object", () => {
    expect(customFieldsParam.parse("{}")).toBeUndefined();
  });

  it("rejects malformed JSON, arrays and non-string values", () => {
    expect(customFieldsParam.safeParse("f1=P1").success).toBe(false);
    expect(customFieldsParam.safeParse('["f1"]').success).toBe(false);
    expect(customFieldsParam.safeParse('{"f1":"P1"}').success).toBe(false);
    expect(customFieldsParam.safeParse('{"f1":[1]}').success).toBe(false);
  });

  it("limits the number of fields and values", () => {
    const tooManyFields = Object.fromEntries(
      Array.from({ length: MAX_FILTER_FIELDS + 1 }, (_, i) => [`f${i}`, ["a"]]),
    );
    expect(
      customFieldsParam.safeParse(JSON.stringify(tooManyFields)).success,
    ).toBe(false);
    const tooManyValues = {
      f1: Array.from({ length: MAX_FILTER_VALUES + 1 }, (_, i) => String(i)),
    };
    expect(
      customFieldsParam.safeParse(JSON.stringify(tooManyValues)).success,
    ).toBe(false);
  });

  it("limits the length of a value", () => {
    expect(
      customFieldsParam.safeParse(JSON.stringify({ f1: ["x".repeat(501)] }))
        .success,
    ).toBe(false);
  });
});
