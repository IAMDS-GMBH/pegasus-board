import { useContext } from "react";
import { AuthContext } from "@/components/providers/auth-provider";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { hasInstanceAdminRole } from "@/lib/instance-admin";

// Pegasus fork (PEGA-170): owners and instance admins may move cards through
// locked columns, like the Hub's system account, which never uses the web app.
// Only spares others a failed drop; the API decides. Without a signed-in user
// nobody is exempt.
export function useCanMoveLockedColumns(): boolean {
  const user = useContext(AuthContext)?.user as
    | { role?: unknown }
    | null
    | undefined;
  const { isOwner } = useWorkspacePermission();
  return Boolean(isOwner) || hasInstanceAdminRole(user?.role);
}
