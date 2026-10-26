import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { TaskFilterControls } from "./filter-subject";
import { useFilterSubjects } from "./use-filter-subjects";
import type { TaskFilterOptions } from "./use-task-filter-options";

vi.mock("@/lib/i18n", () => ({ i18n: { t: (key: string) => key } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const controls = {
  filters: {},
  updateFilter: vi.fn(),
  toggleFilter: vi.fn(),
  setNegated: vi.fn(),
  updateCustomFieldFilter: vi.fn(),
  clearFilters: vi.fn(),
  activeFilterCount: 0,
} as unknown as TaskFilterControls;

const options = {
  members: [],
  labels: [],
  customFields: [
    {
      id: "consent",
      projectId: "p",
      name: "Einwilligung",
      type: "boolean",
      required: false,
      defaultValue: null,
      options: null,
      position: 0,
      showOnCard: false,
      createdAt: "",
      updatedAt: "",
    },
  ],
  usedCustomFieldValues: {},
} as unknown as TaskFilterOptions;

// Pegasus fork (PEGA-90): checkbox values read in the user's language.
describe("useFilterSubjects", () => {
  it("offers translated labels for checkbox fields", () => {
    const { result } = renderHook(() =>
      useFilterSubjects({ controls, options, tasks: [], showStatus: true }),
    );
    const consent = result.current.find(
      (subject) => subject.label === "Einwilligung",
    );
    expect(consent?.options).toEqual([
      { value: "true", label: "settings:customFields.checked" },
      { value: "false", label: "settings:customFields.unchecked" },
    ]);
  });
});
