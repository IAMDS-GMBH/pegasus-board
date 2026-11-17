import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { INTEGRATIONS } from "@/components/project/integrations/integration-definitions";
import { IntegrationsGroup } from "@/components/project/integrations/integrations-group";
import { useIntegrationStatuses } from "@/components/project/integrations/use-integration-statuses";
import { SettingsPage } from "@/components/settings/settings-page";
import { useProjectWebSocket } from "@/hooks/use-project-websocket";

type ProjectIntegrationsPageProps = {
  projectId: string;
};

export function ProjectIntegrationsPage({
  projectId,
}: ProjectIntegrationsPageProps) {
  const { t } = useTranslation();
  useProjectWebSocket(projectId);
  const { statuses, retry } = useIntegrationStatuses(projectId);

  return (
    <>
      <PageTitle title={t("settings:projectIntegrations.pageTitle")} />
      <SettingsPage
        title={t("settings:projectIntegrations.title")}
        description={t("settings:projectIntegrations.subtitle")}
      >
        <IntegrationsGroup
          title={t("settings:projectIntegrations.codeHostingTitle")}
          integrations={INTEGRATIONS.filter(
            (integration) => integration.category === "code",
          )}
          projectId={projectId}
          statuses={statuses}
          onRetry={retry}
        />
        <IntegrationsGroup
          title={t("settings:projectIntegrations.chatTitle")}
          integrations={INTEGRATIONS.filter(
            (integration) => integration.category === "chat",
          )}
          projectId={projectId}
          statuses={statuses}
          onRetry={retry}
        />
      </SettingsPage>
    </>
  );
}
