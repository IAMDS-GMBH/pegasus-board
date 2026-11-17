import type { LucideIcon } from "lucide-react";

export type SettingsNavSubLink = {
  id: string;
  label: string;
  to: string;
};

export type SettingsNavLink = SettingsNavSubLink & {
  icon: LucideIcon;
  // Pegasus fork (PEGA-80): `to` is an absolute URL opened in a new tab.
  external?: boolean;
};

export type SettingsNavGroup = {
  id: string;
  label: string;
  links: SettingsNavLink[];
};

export type SettingsNavProject = {
  id: string;
  name: string;
  icon: LucideIcon;
  links: SettingsNavSubLink[];
};

export type SettingsNav = {
  account: SettingsNavGroup;
  workspace: SettingsNavGroup;
  projects: SettingsNavProject[];
  admin: SettingsNavGroup | null;
};
