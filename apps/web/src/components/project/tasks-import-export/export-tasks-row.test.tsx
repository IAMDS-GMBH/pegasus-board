import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { ProjectWithTasks } from "@/types/project";
import { ExportTasksRow } from "./export-tasks-row";

// Pegasus fork (PEGA-142): exporting needs LEAD_EXPORT where the Hub governs.

const permissions = vi.hoisted(() => ({ canExportTasks: vi.fn(() => true) }));

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => permissions,
}));
vi.mock("@/hooks/mutations/task/use-export-tasks", () => ({
  default: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/lib/toast", () => ({ toast: {} }));
vi.mock("file-saver", () => ({ saveAs: vi.fn() }));
vi.mock("@/components/settings/settings-row", () => ({
  SettingsRow: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

const project = { id: "project-1", slug: "bew" } as ProjectWithTasks;

describe("ExportTasksRow", () => {
  it("offers the export with canExportTasks", () => {
    render(<ExportTasksRow project={project} />);

    expect(
      screen.getByRole("button", { name: "settings:tasksImportExport.export" }),
    ).toBeInTheDocument();
  });

  it("renders nothing without canExportTasks", () => {
    permissions.canExportTasks.mockReturnValueOnce(false);
    const { container } = render(<ExportTasksRow project={project} />);

    expect(container).toBeEmptyDOMElement();
  });
});
