import { Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useReturnTask } from "@/hooks/mutations/task/use-return-task";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type TaskReturnButtonProps = {
  task: Pick<Task, "id" | "projectId" | "userId">;
  // Called after the return; an assigned-only member no longer sees the task.
  onReturned?: () => void;
  className?: string;
};

// Pegasus fork (PEGA-143): only the assignee, with the right to return
// (LEAD_RETURN_OR_REPORT where the Hub governs), sees this.
export function TaskReturnButton({
  task,
  onReturned,
  className,
}: TaskReturnButtonProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { canReturnTasks, isCheckingPermissions } = useWorkspacePermission();
  const { mutateAsync: returnTask, isPending } = useReturnTask();

  if (
    !user?.id ||
    task.userId !== user.id ||
    isCheckingPermissions ||
    !canReturnTasks()
  ) {
    return null;
  }

  const handleReturn = async () => {
    try {
      await returnTask(task);
      toast.success(t("tasks:return.success"));
      onReturned?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("tasks:return.error"),
      );
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      className={cn("w-fit", className)}
      onClick={() => void handleReturn()}
    >
      <Undo2 />
      {t("tasks:return.action")}
    </Button>
  );
}
