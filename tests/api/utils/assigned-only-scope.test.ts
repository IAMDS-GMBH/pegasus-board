import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vite-plus/test";
import { assertTasksVisible } from "../../../apps/api/src/utils/assigned-only-scope";

describe("assertTasksVisible", () => {
  it("does nothing when the user is not restricted", () => {
    expect(() =>
      assertTasksVisible(["someone-else", null], null),
    ).not.toThrow();
  });

  it("passes when every task is assigned to the restricted user", () => {
    expect(() => assertTasksVisible(["me"], "me")).not.toThrow();
    expect(() => assertTasksVisible(["me", "me"], "me")).not.toThrow();
  });

  it("hides a single task assigned to someone else or to nobody", () => {
    for (const assignee of ["someone-else", null]) {
      try {
        assertTasksVisible([assignee], "me");
        throw new Error("expected a 404");
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(404);
        expect((error as HTTPException).message).toBe("Task not found");
      }
    }
  });

  it("hides a bulk request when any task is not assigned to the user", () => {
    try {
      assertTasksVisible(["me", "someone-else"], "me");
      throw new Error("expected a 404");
    } catch (error) {
      expect(error).toBeInstanceOf(HTTPException);
      expect((error as HTTPException).status).toBe(404);
      expect((error as HTTPException).message).toBe("No tasks found");
    }
  });
});
