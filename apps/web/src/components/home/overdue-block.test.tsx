import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { OverdueBlock } from "./overdue-block";

const { getOverdueTasks } = vi.hoisted(() => ({ getOverdueTasks: vi.fn() }));
vi.mock("@/fetchers/task/get-overdue-tasks", () => ({
  default: getOverdueTasks,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
    search,
  }: PropsWithChildren<{
    params: Record<string, string>;
    search?: object;
  }>) => (
    <a
      href={`/${Object.values(params).join("/")}${search ? `?${new URLSearchParams(search as Record<string, string>)}` : ""}`}
    >
      {children}
    </a>
  ),
}));

let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.clearAllMocks();
});

const card = (id: string, projectId: string, projectName: string) => ({
  id,
  projectId,
  number: 1,
  title: `Lead ${id}`,
  status: "unbearbeitet",
  statusName: "Unbearbeitet",
  dueDate: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  assigneeId: id === "a" ? "user-1" : null,
  assigneeName: id === "a" ? "Bea Bearbeiter" : null,
  projectName,
  projectSlug: projectName.toLowerCase(),
});

function mount() {
  return render(
    <QueryClientProvider client={client}>
      <OverdueBlock workspaceId="ws" />
    </QueryClientProvider>,
  );
}

// Pegasus fork (PEGA-66): the start page shows a Führungskraft every overdue
// card of their Sichtbereich, and nothing while there is none.
describe("OverdueBlock", () => {
  it("lists the overdue cards with their count, column, assignee and age", async () => {
    getOverdueTasks.mockResolvedValue({
      tasks: [
        card("a", "p1", "Bewerber-Pool"),
        card("b", "p1", "Bewerber-Pool"),
      ],
      total: 2,
    });

    mount();

    expect(
      await screen.findByRole("heading", {
        name: 'workspace:home.overdue.title {"count":2}',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Lead a").closest("a")).toHaveAttribute(
      "href",
      "/ws/p1/a",
    );
    expect(screen.getAllByText("Unbearbeitet")).toHaveLength(2);
    expect(screen.getByText("Bea Bearbeiter")).toBeInTheDocument();
    expect(
      screen.getByText("workspace:home.overdue.unassigned"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText('workspace:home.overdue.since_hours {"count":5}'),
    ).toHaveLength(2);
    expect(
      screen.getByText("workspace:home.overdue.viewAll").closest("a"),
    ).toHaveAttribute("href", "/ws/p1?filter=overdue");
  });

  it("links to the filtered board of each project with overdue cards", async () => {
    getOverdueTasks.mockResolvedValue({
      tasks: [card("a", "p1", "Bewerber-Pool"), card("b", "p2", "Altbestand")],
      total: 2,
    });

    mount();

    expect(
      (
        await screen.findByText(
          'workspace:home.overdue.viewAllInProject {"project":"Altbestand"}',
        )
      ).closest("a"),
    ).toHaveAttribute("href", "/ws/p2?filter=overdue");
    expect(
      screen
        .getByText(
          'workspace:home.overdue.viewAllInProject {"project":"Bewerber-Pool"}',
        )
        .closest("a"),
    ).toHaveAttribute("href", "/ws/p1?filter=overdue");
  });

  it("shows the ten oldest and says how many there are", async () => {
    const tasks = Array.from({ length: 12 }, (_, i) =>
      card(`n${i}`, "p1", "Bewerber-Pool"),
    );
    getOverdueTasks.mockResolvedValue({ tasks, total: 12 });

    mount();

    expect(
      await screen.findByText(
        'workspace:home.overdue.truncated {"shown":10,"total":12}',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Lead n10")).not.toBeInTheDocument();
  });

  it("renders nothing while no card is overdue", async () => {
    getOverdueTasks.mockResolvedValue({ tasks: [], total: 0 });

    const { container } = mount();

    await waitFor(() => expect(getOverdueTasks).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
