import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import useGetOverdueTasks from "@/hooks/queries/task/use-get-overdue-tasks";
import { OverdueTaskRow } from "./overdue-task-row";
import { SectionHeader } from "./section-header";

type OverdueBlockProps = {
  workspaceId: string;
};

// The oldest first; "alle anzeigen" opens the board for the rest.
const VISIBLE_TASKS = 10;

const linkClass =
  "shrink-0 font-medium text-[13px] text-muted-foreground hover:text-foreground";

// Pegasus fork (PEGA-66): the overdue cards of the caller's Sichtbereich. The
// Hub sets each lead's deadline as its due date; the API applies the scope.
// Hidden while nothing is overdue, so members without deadlines see no change.
export function OverdueBlock({ workspaceId }: OverdueBlockProps) {
  const { t } = useTranslation();
  const { data } = useGetOverdueTasks(workspaceId);
  if (!data?.total) return null;

  const visible = data.tasks.slice(0, VISIBLE_TASKS);

  const projects = [
    ...new Map(
      data.tasks.map((task) => [task.projectId, task.projectName]),
    ).entries(),
  ];
  const boardLink = (projectId: string, label: string) => (
    <Link
      key={projectId}
      to="/dashboard/workspace/$workspaceId/project/$projectId/board"
      params={{ workspaceId, projectId }}
      search={{ filter: "overdue" }}
      className={linkClass}
    >
      {label}
    </Link>
  );

  return (
    <section>
      <SectionHeader
        title={t("workspace:home.overdue.title", { count: data.total })}
        action={
          projects.length === 1
            ? boardLink(projects[0][0], t("workspace:home.overdue.viewAll"))
            : null
        }
      />
      <div className="flex flex-col">
        {visible.map((task) => (
          <OverdueTaskRow key={task.id} task={task} workspaceId={workspaceId} />
        ))}
      </div>
      {data.total > visible.length && (
        <p className="pt-2 text-muted-foreground text-xs">
          {t("workspace:home.overdue.truncated", {
            shown: visible.length,
            total: data.total,
          })}
        </p>
      )}
      {projects.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2">
          {projects.map(([projectId, project]) =>
            boardLink(
              projectId,
              t("workspace:home.overdue.viewAllInProject", { project }),
            ),
          )}
        </div>
      )}
    </section>
  );
}
