import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

type CreateWorkspaceRoleRequest = {
  workspaceId: string;
  role: string;
  permission: Record<string, string[]>;
  assignedOnly: boolean;
};

function useCreateWorkspaceRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      workspaceId,
      role,
      permission,
      assignedOnly,
    }: CreateWorkspaceRoleRequest) => {
      const { data, error } = await authClient.organization.createRole({
        organizationId: workspaceId,
        role,
        permission,
        additionalFields: { assignedOnly },
      });
      if (error) {
        throw new Error(error.message || "Failed to create role");
      }
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["workspace-roles", variables.workspaceId],
      });
    },
  });
}

export default useCreateWorkspaceRole;
