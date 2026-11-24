import { useMutation, useQueryClient } from "@tanstack/react-query";
import createColumn, {
  type CreateColumnData,
} from "@/fetchers/column/create-column";
import { forgetCollapsedColumn } from "@/lib/collapsed-sections";

export function useCreateColumn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: CreateColumnData;
    }) => createColumn(projectId, data),
    onSuccess: async (column) => {
      forgetCollapsedColumn(column.projectId, column.slug);
      await queryClient.invalidateQueries({ refetchType: "all" });
    },
  });
}
