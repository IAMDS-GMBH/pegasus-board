import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { OverdueTask } from "@/fetchers/task/get-overdue-tasks";
import { overdueSince } from "./overdue-since";

type OverdueTaskRowProps = {
  task: OverdueTask;
  workspaceId: string;
};

// Pegasus fork (PEGA-66): one overdue card on the start page.
export function OverdueTaskRow({ task, workspaceId }: OverdueTaskRowProps) {
  const { t } = useTranslation();
  const since = overdueSince(task.dueDate);

  return (
    <Link
      to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
      params={{ workspaceId, projectId: task.projectId, taskId: task.id }}
      className="flex h-11 items-center gap-2.5 border-border/50 border-b border-l-[3px] border-l-due-overdue px-2 outline-none transition-colors hover:bg-accent/50 focus-visible:bg-accent/50"
    >
      <span className="min-w-0 flex-1 truncate text-foreground text-sm">
        {task.title}
      </span>
      <span className="hidden w-28 shrink-0 truncate text-muted-foreground text-xs sm:block">
        {task.statusName ?? task.status}
      </span>
      <span className="hidden w-32 shrink-0 truncate text-muted-foreground text-xs md:block">
        {task.assigneeName ?? t("workspace:home.overdue.unassigned")}
      </span>
      <span className="w-44 shrink-0 truncate text-right font-medium text-due-overdue text-xs">
        {t(`workspace:home.overdue.since_${since.unit}`, {
          count: since.count,
        })}
      </span>
    </Link>
  );
}
