import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import { TaskCustomFieldRows } from "./task-custom-field-rows";

const mocks = vi.hoisted(() => ({
  fields: [] as CustomFieldDefinition[],
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: () => null,
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateProjects: () => false }),
}));
vi.mock("./use-task-custom-fields", () => ({
  useTaskCustomFields: () => ({
    fields: mocks.fields,
    values: {},
    save: vi.fn(),
    canEdit: true,
  }),
}));

afterEach(cleanup);

const field = (
  name: string,
  position: number,
  section: string | null,
): CustomFieldDefinition => ({
  id: name,
  projectId: "project-1",
  name,
  type: "text",
  required: false,
  defaultValue: null,
  options: null,
  position,
  showOnCard: false,
  section,
  createdAt: "",
  updatedAt: "",
});

// Pegasus fork (PEGA-123): Stammdaten apart from the insurance details.
describe("TaskCustomFieldRows", () => {
  it("shows a heading per section and none for fields without one", () => {
    mocks.fields = [
      field("Notiz", 0, null),
      field("Vorname", 1, "Stammdaten"),
      field("Branche", 2, "Versicherungstechnisch"),
      field("Ort", 3, "Stammdaten"),
    ];

    render(<TaskCustomFieldRows taskId="task-1" projectId="project-1" />);

    expect(
      screen.getAllByRole("heading").map((heading) => heading.textContent),
    ).toEqual(["Stammdaten", "Versicherungstechnisch"]);
    const stammdaten = screen.getByRole("group", { name: "Stammdaten" });
    expect(within(stammdaten).getByText("Vorname")).toBeTruthy();
    expect(within(stammdaten).getByText("Ort")).toBeTruthy();
    expect(within(stammdaten).queryByText("Branche")).toBeNull();
    expect(screen.getByText("Notiz")).toBeTruthy();
  });
});
