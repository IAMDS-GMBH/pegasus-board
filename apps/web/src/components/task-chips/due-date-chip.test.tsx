import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type Task from "@/types/task";
import { DueDateChip } from "./due-date-chip";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));
vi.mock("@/components/task/task-due-date-popover", () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const task = { id: "task", status: "to-do" } as Task;

// Pegasus fork (PEGA-66): the Hub's deadline is a moment, not a day, so the
// chip turns red once it has passed, even while the date still reads "today".
describe("DueDateChip", () => {
  it("colors a due moment that passed earlier today", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 25, 15));

    render(
      <DueDateChip
        task={{ ...task, dueDate: new Date(2026, 10, 25, 9).toISOString() }}
      />,
    );

    expect(screen.getByRole("button")).toHaveClass("text-due-overdue");
  });

  it("keeps a passed due date neutral once the task is completed", () => {
    render(
      <DueDateChip
        task={{ ...task, dueDate: "2020-01-01T00:00:00Z" }}
        isCompleted
      />,
    );

    expect(screen.getByRole("button")).not.toHaveClass("text-due-overdue");
  });
});
