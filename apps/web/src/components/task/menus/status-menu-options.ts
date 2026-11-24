import type { OptionMenuItem } from "@/components/common/option-menu/option-menu-item";
import { getColumnIcon } from "@/lib/column";
import { getStatusDisplayLabel } from "@/lib/i18n/domain";

type StatusColumn = {
  slug: string;
  name: string;
  icon?: string | null;
  isFinal: boolean;
  isLocked?: boolean;
};

// Pegasus fork (PEGA-170): without `canMoveLocked`, a locked column is no
// target, and a card sitting in one can go nowhere.
export function statusMenuOptions(
  columns: StatusColumn[],
  current: string | null | undefined,
  canMoveLocked = true,
): OptionMenuItem[] {
  const inLocked = columns.some(
    (column) => column.slug === current && column.isLocked,
  );
  return columns.map((column) => ({
    value: column.slug,
    label: getStatusDisplayLabel(column.slug, column.name),
    icon: getColumnIcon(column.slug, column.isFinal, column.icon),
    selected: column.slug === current,
    disabled:
      !canMoveLocked &&
      column.slug !== current &&
      (inLocked || Boolean(column.isLocked)),
  }));
}
