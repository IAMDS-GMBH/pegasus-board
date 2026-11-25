import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SettingsNavGroup as SettingsNavGroupModel } from "@/components/settings/nav/types";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type SettingsNavGroupProps = {
  group: SettingsNavGroupModel;
  pathname: string;
};

export function SettingsNavGroup({ group, pathname }: SettingsNavGroupProps) {
  const { t } = useTranslation();

  return (
    <SidebarGroup className="gap-0.5 px-2 py-1.5">
      <SidebarGroupLabel className="h-7 truncate text-sidebar-foreground/70">
        {group.label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {group.links.map((link) => (
            <SidebarMenuItem key={link.id}>
              <SidebarMenuButton
                isActive={pathname === link.to}
                className="h-8 text-sm"
                render={
                  // Pegasus fork (PEGA-80): e.g. the Pegasus Hub's
                  // notification settings.
                  link.external ? (
                    // eslint-disable-next-line jsx-a11y/anchor-has-content -- SidebarMenuButton renders the label into it.
                    <a
                      href={link.to}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  ) : (
                    <Link to={link.to} />
                  )
                }
              >
                <link.icon aria-hidden="true" />
                <span>{link.label}</span>
                {link.external ? (
                  <>
                    {" "}
                    <ExternalLink aria-hidden="true" className="ml-auto" />
                    <span className="sr-only">
                      {t("settings:opensInNewTab")}
                    </span>
                  </>
                ) : null}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
