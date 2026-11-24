import type { ReactNode } from "react";

export type OptionMenuItem = {
  value: string;
  label: string;
  icon?: ReactNode;
  selected?: boolean;
  hint?: string;
  pinned?: boolean;
  // Pegasus fork (PEGA-170): shown but not selectable (a locked column).
  disabled?: boolean;
};
