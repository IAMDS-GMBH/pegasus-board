import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";

// Pegasus fork (PEGA-170): marks a locked (technical) column.
export function ColumnLockHint() {
  const { t } = useTranslation();
  const label = t("tasks:kanban.lockedHint");

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="flex shrink-0 text-chip-icon"
    >
      <Lock aria-hidden="true" className="size-3" />
    </span>
  );
}
