import assert from "node:assert/strict";
import { test } from "node:test";
import { planOrder } from "./plan-order.mjs";

const at = (ids) => ids.map((id, position) => ({ id, position }));

test("the wanted order needs no reorder", () => {
  assert.equal(planOrder(["a", "b"], at(["a", "b"])), null);
});

test("wanted items come first, others keep their order behind them", () => {
  assert.deepEqual(
    planOrder(["b", "a"], at(["x", "a", "b", "y"])),
    at(["b", "a", "x", "y"]),
  );
});

test("gaps in the positions are closed", () => {
  assert.deepEqual(
    planOrder(
      ["a", "b"],
      [
        { id: "a", position: 0 },
        { id: "b", position: 5 },
      ],
    ),
    at(["a", "b"]),
  );
});
