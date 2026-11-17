import { createFileRoute, Navigate } from "@tanstack/react-router";
import { ProjectIntegrationsPage } from "@/components/project/integrations/project-integrations-page";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/$projectId/integrations",
)({
  component: RouteComponent,
});

// Pegasus fork (PEGA-80): in a workspace the Pegasus Hub manages, only owners,
// instance admins and the Hub's system account manage integrations. The page
// mounts only once that is known, so its requests never start for others.
function RouteComponent() {
  const { projectId } = Route.useParams();
  const { workspace, member, isCheckingPermissions, canManageIntegrations } =
    useWorkspacePermission();

  if (!workspace || !member || isCheckingPermissions) return null;
  if (!canManageIntegrations()) {
    return (
      <Navigate
        to="/dashboard/settings/projects/$projectId/general"
        params={{ projectId }}
        replace
      />
    );
  }
  return <ProjectIntegrationsPage projectId={projectId} />;
}
