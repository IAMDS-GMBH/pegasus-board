import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { ProjectStatisticsCells } from "./project-statistics-cells";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

afterEach(cleanup);

function renderCells(completionPercentage: number, totalTasks: number) {
  render(
    <table>
      <tbody>
        <tr>
          <ProjectStatisticsCells
            statistics={{ completionPercentage, totalTasks, dueDate: null }}
          />
        </tr>
      </tbody>
    </table>,
  );
}

it.each([
  [0, 0, "workspace:projects.projectStatus.notStarted"],
  [40, 5, "workspace:projects.projectStatus.inProgress"],
  [100, 5, "workspace:projects.projectStatus.complete"],
])("shows %i%% of %i tasks as %s", (percentage, total, status) => {
  renderCells(percentage, total);

  expect(screen.getByText(`${percentage}%`)).toBeInTheDocument();
  expect(screen.getByText(status)).toBeInTheDocument();
  expect(screen.getByText("workspace:projects.noDueDate")).toBeInTheDocument();
});
