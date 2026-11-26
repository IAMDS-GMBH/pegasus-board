import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AddColumnRow,
  type NewColumn,
} from "@/components/project/columns/add-column-row";
import { ColumnListHeader } from "@/components/project/columns/column-list-header";
import { ColumnListSkeleton } from "@/components/project/columns/column-list-skeleton";
import { ColumnRow } from "@/components/project/columns/column-row";
import type { ProjectColumn } from "@/components/project/columns/types";
import { errorMessage } from "@/components/project/error-message";
import { toPositions } from "@/components/project/sortable/apply-order";
import { SortableList } from "@/components/project/sortable/sortable-list";
import { useSortableOrder } from "@/components/project/sortable/use-sortable-order";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { SettingsCard } from "@/components/settings/settings-card";
import type { UpdateColumnData } from "@/fetchers/column/update-column";
import { useCreateColumn } from "@/hooks/mutations/column/use-create-column";
import { useDeleteColumn } from "@/hooks/mutations/column/use-delete-column";
import { useReorderColumns } from "@/hooks/mutations/column/use-reorder-columns";
import { useUpdateColumn } from "@/hooks/mutations/column/use-update-column";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";

type ColumnListProps = {
  projectId: string;
};

const NO_COLUMNS: ProjectColumn[] = [];

export function ColumnList({ projectId }: ColumnListProps) {
  const { t } = useTranslation();
  const { data: columns = NO_COLUMNS, isLoading } = useGetColumns(projectId);
  const { mutateAsync: createColumn } = useCreateColumn();
  const { mutateAsync: updateColumn } = useUpdateColumn();
  const { mutateAsync: deleteColumn, isPending: deleting } = useDeleteColumn();
  const { mutateAsync: reorderColumns } = useReorderColumns();
  const { canManageProjects } = useWorkspacePermission();
  const canEdit = canManageProjects();
  const [pendingDelete, setPendingDelete] = useState<ProjectColumn | null>(
    null,
  );
  // Pegasus fork (PEGA-170): the project's phases, suggested in every phase input.
  const phaseSuggestionsId = useId();
  const phases = [...new Set(columns.flatMap((column) => column.phase ?? []))];

  const { ordered, move } = useSortableOrder(columns, async (next) => {
    try {
      await reorderColumns({ projectId, columns: toPositions(next) });
    } catch (error) {
      toast.error(errorMessage(error, t("settings:columnEditor.reorderError")));
    }
  });

  const update = async (
    id: string,
    data: UpdateColumnData,
    fallbackKey: string,
  ) => {
    try {
      await updateColumn({ id, projectId, data });
      return true;
    } catch (error) {
      toast.error(errorMessage(error, t(fallbackKey)));
      return false;
    }
  };

  const create = async (data: NewColumn) => {
    try {
      await createColumn({ projectId, data });
      return true;
    } catch (error) {
      toast.error(
        errorMessage(error, t("settings:columnEditor.toastCreateError")),
      );
      return false;
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteColumn({ id: pendingDelete.id, projectId });
      setPendingDelete(null);
    } catch (error) {
      toast.error(
        errorMessage(error, t("settings:columnEditor.toastDeleteError")),
      );
    }
  };

  if (isLoading) return <ColumnListSkeleton />;

  return (
    <>
      <SettingsCard>
        <ColumnListHeader />
        <SortableList ids={ordered.map((column) => column.id)} onMove={move}>
          {ordered.map((column) => (
            <ColumnRow
              key={column.id}
              column={column}
              canEdit={canEdit}
              onRename={(name) =>
                update(
                  column.id,
                  { name },
                  "settings:columnEditor.toastRenameError",
                )
              }
              onChangeIcon={(icon) =>
                void update(
                  column.id,
                  { icon },
                  "settings:columnEditor.toastUpdateError",
                )
              }
              onToggleFinal={async (isFinal) => {
                await update(
                  column.id,
                  { isFinal },
                  "settings:columnEditor.toastUpdateError",
                );
              }}
              phaseSuggestionsId={phaseSuggestionsId}
              onChangePhase={(phase) =>
                update(
                  column.id,
                  { phase },
                  "settings:columnEditor.toastUpdateError",
                )
              }
              onToggleLocked={async (isLocked) => {
                await update(
                  column.id,
                  { isLocked },
                  "settings:columnEditor.toastUpdateError",
                );
              }}
              onToggleRestricted={async (isRestricted) => {
                await update(
                  column.id,
                  { isRestricted },
                  "settings:columnEditor.toastUpdateError",
                );
              }}
              onDelete={() => setPendingDelete(column)}
            />
          ))}
        </SortableList>
        {canEdit ? (
          <AddColumnRow
            phaseSuggestionsId={phaseSuggestionsId}
            onCreate={create}
          />
        ) : null}
        <datalist id={phaseSuggestionsId}>
          {phases.map((phase) => (
            <option key={phase} value={phase} />
          ))}
        </datalist>
      </SettingsCard>
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={t("settings:columnEditor.deleteTitle", {
          name: pendingDelete?.name ?? "",
        })}
        description={t("settings:columnEditor.deleteDescription")}
        confirmLabel={t("settings:columnEditor.deleteConfirm")}
        pendingLabel={t("common:actions.deleting")}
        pending={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
