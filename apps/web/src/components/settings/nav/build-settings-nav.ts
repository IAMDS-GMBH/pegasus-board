import {
  Bell,
  Building2,
  Code,
  CreditCard,
  Import,
  KeyRound,
  Server,
  Settings,
  Shield,
  SlidersHorizontal,
  Tag,
  User,
} from "lucide-react";
import projectIcons from "@/constants/project-icons";
import type {
  SettingsNav,
  SettingsNavProject,
} from "@/components/settings/nav/types";

type Translate = (key: string) => string;

type BuildSettingsNavInput = {
  t: Translate;
  workspaceName?: string;
  billingEnabled: boolean;
  canImport: boolean;
  hasAdminAccess: boolean;
  // Pegasus fork (PEGA-80): the Pegasus Hub owns notification settings, and
  // only members it does not govern may manage integrations.
  notificationSettingsUrl: string | null;
  canManageIntegrations: boolean;
  projects: { id: string; name: string; icon?: string | null }[];
};

const PROJECT_SECTIONS = [
  { id: "general", labelKey: "settings:projectGeneral.title" },
  { id: "workflow", labelKey: "settings:projectWorkflow.title" },
  { id: "custom-fields", labelKey: "settings:projectCustomFields.title" },
  { id: "visibility", labelKey: "settings:projectVisibility.title" },
  { id: "integrations", labelKey: "settings:projectIntegrations.title" },
  { id: "calendar", labelKey: "settings:calendarFeeds.title" },
] as const;

function buildProject(
  t: Translate,
  project: BuildSettingsNavInput["projects"][number],
  canManageIntegrations: boolean,
): SettingsNavProject {
  const icon =
    projectIcons[project.icon as keyof typeof projectIcons] ??
    projectIcons.Layout;

  return {
    id: project.id,
    name: project.name,
    icon,
    links: PROJECT_SECTIONS.filter(
      (section) => section.id !== "integrations" || canManageIntegrations,
    ).map((section) => ({
      id: `project-${project.id}-${section.id}`,
      label: t(section.labelKey),
      to: `/dashboard/settings/projects/${project.id}/${section.id}`,
    })),
  };
}

export function buildSettingsNav({
  t,
  workspaceName,
  billingEnabled,
  canImport,
  hasAdminAccess,
  notificationSettingsUrl,
  canManageIntegrations,
  projects,
}: BuildSettingsNavInput): SettingsNav {
  return {
    account: {
      id: "account",
      label: t("settings:account"),
      links: [
        {
          id: "information",
          label: t("settings:information"),
          to: "/dashboard/settings/account/information",
          icon: User,
        },
        {
          id: "preferences",
          label: t("settings:preferences"),
          to: "/dashboard/settings/account/preferences",
          icon: SlidersHorizontal,
        },
        ...(notificationSettingsUrl
          ? [
              {
                id: "notifications",
                label: t("settings:notifications"),
                to: notificationSettingsUrl,
                icon: Bell,
                external: true,
              },
            ]
          : []),
        {
          id: "security",
          label: t("settings:security"),
          to: "/dashboard/settings/account/security",
          icon: KeyRound,
        },
        {
          id: "developer",
          label: t("settings:apiKeys"),
          to: "/dashboard/settings/account/developer",
          icon: Code,
        },
      ],
    },
    workspace: {
      id: "workspace",
      label: workspaceName || t("navigation:page.settingsWorkspaceTab"),
      links: [
        {
          id: "workspace-general",
          label: t("settings:workspaceGeneral.title"),
          to: "/dashboard/settings/workspace/general",
          icon: Settings,
        },
        {
          id: "workspace-roles",
          label: t("settings:workspaceRoles.title"),
          to: "/dashboard/settings/workspace/roles",
          icon: Shield,
        },
        {
          id: "workspace-labels",
          label: t("settings:workspaceLabels.title"),
          to: "/dashboard/settings/workspace/labels",
          icon: Tag,
        },
        ...(canImport
          ? [
              {
                id: "workspace-import",
                label: t("settings:workspaceImport.title"),
                to: "/dashboard/settings/workspace/import",
                icon: Import,
              },
            ]
          : []),
        ...(billingEnabled
          ? [
              {
                id: "workspace-billing",
                label: t("settings:billing.pageTitle"),
                to: "/dashboard/settings/workspace/billing",
                icon: CreditCard,
              },
            ]
          : []),
      ],
    },
    projects: projects.map((project) =>
      buildProject(t, project, canManageIntegrations),
    ),
    admin: hasAdminAccess
      ? {
          id: "admin",
          label: t("settings:administration"),
          links: [
            {
              id: "admin-users",
              label: t("settings:adminUsers.title"),
              to: "/dashboard/settings/admin/users",
              icon: Server,
            },
            {
              id: "admin-workspaces",
              label: t("settings:adminWorkspaces.title"),
              to: "/dashboard/settings/admin/workspaces",
              icon: Building2,
            },
          ],
        }
      : null,
  };
}
