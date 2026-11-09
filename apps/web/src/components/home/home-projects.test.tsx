import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { HomeProjects } from "./home-projects";

// Pegasus fork (PEGA-142): without REPORTING_VIEW the API leaves statistics
// out; the card shows the project, not zeros as figures.

const data = vi.hoisted(() => ({ projects: [] as unknown[] }));

vi.mock("@/hooks/queries/project/use-get-projects", () => ({
  default: () => ({ data: data.projects, isPending: false, isError: false }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
}));

afterEach(cleanup);

describe("HomeProjects", () => {
  it("shows a project's progress and task count", () => {
    data.projects = [
      {
        id: "p",
        name: "Bewerber-Pool",
        icon: "Layout",
        statistics: { completionPercentage: 40, totalTasks: 5, dueDate: null },
      },
    ];
    render(<HomeProjects workspaceId="w" />);

    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(
      screen.getByText("workspace:home.projects.tasks:5"),
    ).toBeInTheDocument();
  });

  it("shows only the project when the API left the statistics out", () => {
    data.projects = [{ id: "p", name: "Bewerber-Pool", icon: "Layout" }];
    render(<HomeProjects workspaceId="w" />);

    expect(screen.getByText("Bewerber-Pool")).toBeInTheDocument();
    expect(screen.queryByText(/%$/)).toBeNull();
    expect(screen.queryByText(/workspace:home\.projects\.tasks/)).toBeNull();
  });
});
