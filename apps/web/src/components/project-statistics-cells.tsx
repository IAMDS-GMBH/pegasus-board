import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TableCell } from "@/components/ui/table";
import { formatDateMedium } from "@/lib/format";

export type ProjectStatistics = {
  completionPercentage: number;
  totalTasks: number;
  dueDate: string | null;
};

// The progress, due date and status cells of a row on the projects page.
export function ProjectStatisticsCells({
  statistics,
}: {
  statistics: ProjectStatistics;
}) {
  const { t } = useTranslation();
  const { completionPercentage, totalTasks, dueDate } = statistics;

  const status =
    totalTasks === 0
      ? {
          text: t("workspace:projects.projectStatus.notStarted"),
          variant: "secondary" as const,
        }
      : completionPercentage === 100
        ? {
            text: t("workspace:projects.projectStatus.complete"),
            variant: "default" as const,
          }
        : {
            text: t("workspace:projects.projectStatus.inProgress"),
            variant: "outline" as const,
          };

  return (
    <>
      <TableCell className="py-3">
        <div className="flex items-center gap-2">
          <Progress value={completionPercentage} className="w-16 h-2" />
          <span className="text-sm text-muted-foreground">
            {completionPercentage}%
          </span>
        </div>
      </TableCell>
      <TableCell className="py-3">
        <span className="text-sm text-muted-foreground">
          {dueDate
            ? formatDateMedium(dueDate)
            : t("workspace:projects.noDueDate")}
        </span>
      </TableCell>
      <TableCell className="py-3">
        <Badge variant={status.variant}>{status.text}</Badge>
      </TableCell>
    </>
  );
}
